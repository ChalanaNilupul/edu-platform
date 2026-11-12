import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type ActiveMembership = {
  id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
};

@Injectable()
export class WorkspaceAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getActiveMembership(userId: string, workspaceId: string): Promise<ActiveMembership> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return membership;
  }

  async requireRoles(
    userId: string,
    workspaceId: string,
    roles: WorkspaceRole[],
  ): Promise<ActiveMembership> {
    const membership = await this.getActiveMembership(userId, workspaceId);

    if (membership.role !== WorkspaceRole.OWNER && !roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return membership;
  }
}
