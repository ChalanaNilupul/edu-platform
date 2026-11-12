import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { WorkspaceRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

@Injectable()
export class MembershipsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  async list(actorId: string, workspaceId: string) {
    await this.workspaceAccess.requireRoles(actorId, workspaceId, [WorkspaceRole.ADMIN]);

    return this.prisma.membership.findMany({
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
  }

  async updateRole(
    actorId: string,
    workspaceId: string,
    membershipId: string,
    role: WorkspaceRole,
  ) {
    await this.workspaceAccess.requireRoles(actorId, workspaceId, [WorkspaceRole.OWNER]);

    const target = await this.prisma.membership.findFirst({
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

    return this.prisma.membership.update({
      where: { id: target.id },
      data: { role },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  async remove(actorId: string, workspaceId: string, membershipId: string) {
    const actor = await this.workspaceAccess.requireRoles(actorId, workspaceId, [
      WorkspaceRole.ADMIN,
    ]);

    const target = await this.prisma.membership.findFirst({
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

    await this.prisma.$transaction([
      this.prisma.membership.delete({
        where: { id: target.id },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: target.userId,
          activeWorkspaceId: workspaceId,
        },
        data: { activeWorkspaceId: null },
      }),
    ]);

    return { message: 'Member removed' };
  }
}
