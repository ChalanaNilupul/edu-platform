import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MembershipStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';

@Injectable()
export class WorkspacesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(userId: string, sessionId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
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

      await tx.membership.create({
        data: {
          userId,
          workspaceId: workspace.id,
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
        membershipStatus: MembershipStatus.ACTIVE,
        activeWorkspaceId: workspace.id,
      };
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        memberships: {
          some: {
            userId,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async switchWorkspace(userId: string, sessionId: string, workspaceId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Confirm that the user has an active membership.
      const membership = await tx.membership.findFirst({
        where: {
          userId,
          workspaceId,
          status: MembershipStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You do not have active access to this workspace');
      }

      // Update only the authenticated user's current session.
      const result = await tx.session.updateMany({
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

      if (result.count !== 1) {
        throw new ForbiddenException('Session is no longer valid');
      }

      return {
        message: 'Workspace switched successfully',
        activeWorkspaceId: workspaceId,
      };
    });
  }
}
