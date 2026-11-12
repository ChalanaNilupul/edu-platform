import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipStatus, WorkspaceType } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { WorkspacesService } from './workspaces.service.js';
import { ForbiddenException } from '@nestjs/common';

describe('WorkspacesService', () => {
  const workspace = {
    id: 'workspace-123',
    name: 'My Tuition Class',
    type: WorkspaceType.TEACHER,
    createdAt: new Date(),
  };

  const tx = {
    workspace: {
      create: vi.fn(),
    },
    membership: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    session: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prismaMock = {
    $transaction: vi.fn(),
    workspace: {
      findMany: vi.fn(),
    },
  };

  let service: WorkspacesService;

  beforeEach(() => {
    vi.clearAllMocks();

    tx.workspace.create.mockResolvedValue(workspace);
    tx.membership.create.mockResolvedValue({
      id: 'membership-123',
    });

    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    service = new WorkspacesService(prismaMock as unknown as PrismaService);
  });

  it('creates a workspace and adds its creator as an active member', async () => {
    const userId = 'user-123';
    const dto: CreateWorkspaceDto = {
      name: 'My Tuition Class',
      type: WorkspaceType.TEACHER,
    };

    const result = await service.create(userId, 'session-123', dto);

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();

    expect(tx.workspace.create).toHaveBeenCalledWith({
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

    expect(tx.membership.create).toHaveBeenCalledWith({
      data: {
        userId,
        workspaceId: workspace.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    expect(result).toEqual({
      ...workspace,
      membershipStatus: MembershipStatus.ACTIVE,
      activeWorkspaceId: 'workspace-123',
    });
  });

  it('rejects workspace creation when the session is no longer valid', async () => {
    tx.session.updateMany.mockResolvedValue({
      count: 0,
    });

    const dto: CreateWorkspaceDto = {
      name: 'My Tuition Class',
      type: WorkspaceType.TEACHER,
    };

    await expect(service.create('user-123', 'session-123', dto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lists only workspaces with an active membership for the user', async () => {
    const userId = 'user-123';
    prismaMock.workspace.findMany.mockResolvedValue([workspace]);

    const result = await service.findAllForUser(userId);

    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith({
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

    expect(result).toEqual([workspace]);
  });
  it('switches to a workspace when the user has active membership', async () => {
    tx.membership.findFirst.mockResolvedValue({
      id: 'membership-123',
    });
    tx.session.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.switchWorkspace('user-123', 'session-123', 'workspace-123');

    expect(tx.membership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: MembershipStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-123',
        userId: 'user-123',
        expiresAt: {
          gt: expect.any(Date),
        },
      },
      data: {
        activeWorkspaceId: 'workspace-123',
      },
    });

    expect(result).toEqual({
      message: 'Workspace switched successfully',
      activeWorkspaceId: 'workspace-123',
    });
  });

  it('rejects switching when the user has no active membership', async () => {
    tx.membership.findFirst.mockResolvedValue(null);

    await expect(
      service.switchWorkspace('user-123', 'session-123', 'workspace-123'),
    ).rejects.toThrow(ForbiddenException);

    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  it('rejects switching when the session is no longer valid', async () => {
    tx.membership.findFirst.mockResolvedValue({
      id: 'membership-123',
    });
    tx.session.updateMany.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.switchWorkspace('user-123', 'session-123', 'workspace-123'),
    ).rejects.toThrow(ForbiddenException);
  });
});
