import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import { MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';

export type ActiveMembership = {
  id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
};

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
  ) {}

  async getActiveMembership(
    userId: string,
    workspaceId: string,
    db?: DbClient,
  ): Promise<ActiveMembership> {
    if (db) {
      return this.findActiveMembership(db, userId, workspaceId);
    }

    return this.tenant.runAsTenant(workspaceId, (tx) =>
      this.findActiveMembership(tx, userId, workspaceId),
    );
  }

  async requireRoles(
    userId: string,
    workspaceId: string,
    roles: WorkspaceRole[],
    db?: DbClient,
  ): Promise<ActiveMembership> {
    const membership = db
      ? await this.findActiveMembership(db, userId, workspaceId)
      : await this.getActiveMembership(userId, workspaceId);

    if (membership.role !== WorkspaceRole.OWNER && !roles.includes(membership.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return membership;
  }

  private async findActiveMembership(
    db: DbClient,
    userId: string,
    workspaceId: string,
  ): Promise<ActiveMembership> {
    const membership = await db.membership.findUnique({
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
}
