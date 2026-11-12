import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { AuditEventType, WorkspaceRole } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

@Injectable()
export class MembershipsService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, [WorkspaceRole.ADMIN], tx);

      return tx.membership.findMany({
        where: { workspaceId },
        select: {
          id: true,
          role: true,
          status: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  async updateRole(
    actorId: string,
    workspaceId: string,
    membershipId: string,
    role: WorkspaceRole,
  ) {
    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, [WorkspaceRole.OWNER], tx);

      const target = await tx.membership.findFirst({
        where: {
          id: membershipId,
          workspaceId,
        },
        select: {
          id: true,
          userId: true,
          role: true,
        },
      });

      if (!target) {
        throw new NotFoundException('Membership not found');
      }

      if (target.role === WorkspaceRole.OWNER || role === WorkspaceRole.OWNER) {
        throw new BadRequestException('Workspace ownership cannot be changed here');
      }

      if (target.userId === actorId) {
        throw new BadRequestException('You cannot change your own role');
      }

      const updated = await tx.membership.update({
        where: { id: target.id },
        data: { role },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });

      return { updated, previousRole: target.role };
    });

    await this.audit.record({
      type: AuditEventType.MEMBER_ROLE_CHANGED,
      actorUserId: actorId,
      workspaceId,
      targetId: membershipId,
      metadata: { from: result.previousRole, to: role },
    });

    return result.updated;
  }

  async remove(actorId: string, workspaceId: string, membershipId: string) {
    const removedRole = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const actor = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        [WorkspaceRole.ADMIN],
        tx,
      );

      const target = await tx.membership.findFirst({
        where: {
          id: membershipId,
          workspaceId,
        },
        select: {
          id: true,
          userId: true,
          role: true,
        },
      });

      if (!target) {
        throw new NotFoundException('Membership not found');
      }

      if (target.userId === actorId) {
        throw new BadRequestException('You cannot remove your own membership');
      }

      if (target.role === WorkspaceRole.OWNER) {
        throw new BadRequestException('The workspace owner cannot be removed');
      }

      if (actor.role !== WorkspaceRole.OWNER && target.role === WorkspaceRole.ADMIN) {
        throw new ForbiddenException('Only the workspace owner can remove administrators');
      }

      await tx.membership.delete({
        where: { id: target.id },
      });

      await tx.session.updateMany({
        where: {
          userId: target.userId,
          activeWorkspaceId: workspaceId,
        },
        data: { activeWorkspaceId: null },
      });

      return target.role;
    });

    await this.audit.record({
      type: AuditEventType.MEMBER_REMOVED,
      actorUserId: actorId,
      workspaceId,
      targetId: membershipId,
      metadata: { role: removedRole },
    });

    return { message: 'Member removed' };
  }
}
