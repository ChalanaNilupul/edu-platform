import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipStatus, WorkspaceRole, WorkspaceType } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
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
    $queryRawUnsafe: vi.fn(),
    workspace: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    membership: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    session: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prismaMock = {
    $transaction: vi.fn(),
  };

  const tenantMock = {
    runAsTenant: vi.fn(),
    runAsUser: vi.fn(),
    runAsSystem: vi.fn(),
  };

  const workspaceAccessMock = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  let service: WorkspacesService;

  beforeEach(() => {
    vi.resetAllMocks();

    tx.$queryRawUnsafe.mockResolvedValue([{ set_config: 'workspace-123' }]);
    tx.workspace.create.mockResolvedValue(workspace);
    tx.membership.create.mockResolvedValue({
      id: 'membership-123',
    });
    tx.session.updateMany.mockResolvedValue({ count: 1 });

    prismaMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    );
    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    tenantMock.runAsUser.mockImplementation(
      async (_userId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    service = new WorkspacesService(
      prismaMock as unknown as PrismaService,
      tenantMock as unknown as TenantContextService,
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

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      `SELECT set_config('app.workspace_id', $1, true)`,
      workspace.id,
    );

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
    tx.membership.findMany.mockResolvedValue([
      {
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        workspace,
      },
    ]);

    const result = await service.findAllForUser(userId);

    expect(tenantMock.runAsUser).toHaveBeenCalledWith(userId, expect.any(Function));
    expect(tx.membership.findMany).toHaveBeenCalledWith({
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
    tx.workspace.findUnique.mockResolvedValue(workspace);

    const result = await service.getById('user-123', 'workspace-123');

    expect(tenantMock.runAsTenant).toHaveBeenCalledWith('workspace-123', expect.any(Function));
    expect(workspaceAccessMock.getActiveMembership).toHaveBeenCalledWith(
      'user-123',
      'workspace-123',
      tx,
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
    expect(tx.workspace.findUnique).not.toHaveBeenCalled();
  });

  it('returns not found when the workspace was removed after the access check', async () => {
    workspaceAccessMock.getActiveMembership.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.OWNER,
    });
    tx.workspace.findUnique.mockResolvedValue(null);

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

    expect(tenantMock.runAsTenant).toHaveBeenCalledWith('workspace-123', expect.any(Function));
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
