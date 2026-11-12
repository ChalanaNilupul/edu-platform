import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipStatus, WorkspaceRole, WorkspaceType } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { WorkspaceAccessService } from './workspace-access.service.js';
import { WorkspacesService } from './workspaces.service.js';

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
    membership: {
      findMany: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
  };

  const workspaceAccessMock = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  let service: WorkspacesService;

  beforeEach(() => {
    vi.resetAllMocks();

    tx.workspace.create.mockResolvedValue(workspace);
    tx.membership.create.mockResolvedValue({
      id: 'membership-123',
    });
    tx.session.updateMany.mockResolvedValue({ count: 1 });

    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );

    service = new WorkspacesService(
      prismaMock as unknown as PrismaService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
    );
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
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    expect(result).toEqual({
      ...workspace,
      role: WorkspaceRole.OWNER,
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
    prismaMock.membership.findMany.mockResolvedValue([
      {
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        workspace,
      },
    ]);

    const result = await service.findAllForUser(userId);

    expect(prismaMock.membership.findMany).toHaveBeenCalledWith({
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
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(result).toEqual([
      {
        ...workspace,
        membershipId: 'membership-123',
        role: WorkspaceRole.TEACHER,
      },
    ]);
  });

  it('returns a workspace when the user has an active membership', async () => {
    workspaceAccessMock.getActiveMembership.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
    });
    prismaMock.workspace.findUnique.mockResolvedValue(workspace);

    const result = await service.getById('user-123', 'workspace-123');

    expect(workspaceAccessMock.getActiveMembership).toHaveBeenCalledWith(
      'user-123',
      'workspace-123',
    );
    expect(result).toEqual({
      ...workspace,
      membershipId: 'membership-123',
      role: WorkspaceRole.ADMIN,
    });
  });

  it('propagates the access check when getting a workspace without membership', async () => {
    workspaceAccessMock.getActiveMembership.mockRejectedValue(
      new ForbiddenException('You do not have access to this workspace'),
    );

    await expect(service.getById('user-123', 'workspace-123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prismaMock.workspace.findUnique).not.toHaveBeenCalled();
  });

  it('returns not found when the workspace was removed after the access check', async () => {
    workspaceAccessMock.getActiveMembership.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.OWNER,
    });
    prismaMock.workspace.findUnique.mockResolvedValue(null);

    await expect(service.getById('user-123', 'workspace-123')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('switches to a workspace when the user has active membership', async () => {
    tx.membership.findFirst.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
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
        role: true,
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
      role: WorkspaceRole.TEACHER,
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
