import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { AuditEventType, MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    emailVerifiedAt: Date | null,
    sessionId: string,
    dto: CreateWorkspaceDto,
  ) {
    if (!emailVerifiedAt) {
      throw new ForbiddenException('Verify your email address before creating a workspace');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          type: dto.type,
        },
        select: {
          id: true,
          name: true,
          type: true,
          createdAt: true,
        },
      });

      await tx.$queryRawUnsafe(`SELECT set_config('app.workspace_id', $1, true)`, workspace.id);

      await tx.membership.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      const session = await tx.session.updateMany({
        where: {
          id: sessionId,
          userId,
          expiresAt: { gt: new Date() },
        },
        data: {
          activeWorkspaceId: workspace.id,
        },
      });

      if (session.count !== 1) {
        throw new ForbiddenException('Session is no longer valid');
      }

      return {
        ...workspace,
        role: WorkspaceRole.OWNER,
        membershipStatus: MembershipStatus.ACTIVE,
        activeWorkspaceId: workspace.id,
      };
    });

    await this.audit.record({
      type: AuditEventType.WORKSPACE_CREATED,
      actorUserId: userId,
      workspaceId: created.id,
    });

    return created;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.tenant.runAsUser(userId, (tx) =>
      tx.membership.findMany({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              type: true,
              currency: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    return memberships.map((membership) => ({
      ...membership.workspace,
      membershipId: membership.id,
      role: membership.role,
    }));
  }

  async getById(userId: string, workspaceId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.getActiveMembership(userId, workspaceId, tx);

      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          createdAt: true,
        },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      return {
        ...workspace,
        membershipId: membership.id,
        role: membership.role,
      };
    });
  }

  async switchWorkspace(userId: string, sessionId: string, workspaceId: string) {
    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await tx.membership.findFirst({
        where: {
          userId,
          workspaceId,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You do not have active access to this workspace');
      }

      const session = await tx.session.updateMany({
        where: {
          id: sessionId,
          userId,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          activeWorkspaceId: workspaceId,
        },
      });

      if (session.count !== 1) {
        throw new ForbiddenException('Session is no longer valid');
      }

      return {
        message: 'Workspace switched successfully',
        activeWorkspaceId: workspaceId,
        role: membership.role,
      };
    });

    await this.audit.record({
      type: AuditEventType.WORKSPACE_SWITCHED,
      actorUserId: userId,
      workspaceId,
    });

    return result;
  }
}
