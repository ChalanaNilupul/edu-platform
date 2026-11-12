import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Prisma } from '../generated/prisma/client.js';
import { MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

describe('WorkspaceAccessService', () => {
  const tx = {
    membership: {
      findUnique: vi.fn(),
    },
  };

  const prismaMock = {};

  const tenantMock = {
    runAsTenant: vi.fn(),
    runAsUser: vi.fn(),
    runAsSystem: vi.fn(),
  };

  let service: WorkspaceAccessService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    service = new WorkspaceAccessService(
      prismaMock as unknown as PrismaService,
      tenantMock as unknown as TenantContextService,
    );
  });

  it('returns the membership when it is active', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    };

    tx.membership.findUnique.mockResolvedValue(membership);

    await expect(service.getActiveMembership('user-123', 'workspace-123')).resolves.toEqual(
      membership,
    );

    expect(tenantMock.runAsTenant).toHaveBeenCalledWith('workspace-123', expect.any(Function));
    expect(tx.membership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_workspaceId: {
          userId: 'user-123',
          workspaceId: 'workspace-123',
        },
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  });

  it('rejects when the user has no membership', async () => {
    tx.membership.findUnique.mockResolvedValue(null);

    await expect(service.getActiveMembership('user-123', 'workspace-123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when the membership is not active', async () => {
    tx.membership.findUnique.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
      status: MembershipStatus.SUSPENDED,
    });

    await expect(service.getActiveMembership('user-123', 'workspace-123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reuses an existing transaction instead of opening another one', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    };

    tx.membership.findUnique.mockResolvedValue(membership);

    await expect(
      service.getActiveMembership(
        'user-123',
        'workspace-123',
        tx as unknown as Prisma.TransactionClient,
      ),
    ).resolves.toEqual(membership);

    expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
  });

  it('allows a role in the required list', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    };

    tx.membership.findUnique.mockResolvedValue(membership);

    await expect(
      service.requireRoles('user-123', 'workspace-123', [WorkspaceRole.ADMIN]),
    ).resolves.toEqual(membership);
  });

  it('always allows the workspace owner', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    };

    tx.membership.findUnique.mockResolvedValue(membership);

    await expect(
      service.requireRoles('user-123', 'workspace-123', [WorkspaceRole.TEACHER]),
    ).resolves.toEqual(membership);
  });

  it('rejects a role that is not in the required list', async () => {
    tx.membership.findUnique.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.STUDENT,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      service.requireRoles('user-123', 'workspace-123', [WorkspaceRole.ADMIN]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
