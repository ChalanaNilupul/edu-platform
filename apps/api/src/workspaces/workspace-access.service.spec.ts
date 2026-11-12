import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { WorkspaceAccessService } from './workspace-access.service.js';

describe('WorkspaceAccessService', () => {
  const prismaMock = {
    membership: {
      findUnique: vi.fn(),
    },
  };

  let service: WorkspaceAccessService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new WorkspaceAccessService(prismaMock as unknown as PrismaService);
  });

  it('returns the membership when it is active', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    };

    prismaMock.membership.findUnique.mockResolvedValue(membership);

    await expect(service.getActiveMembership('user-123', 'workspace-123')).resolves.toEqual(
      membership,
    );

    expect(prismaMock.membership.findUnique).toHaveBeenCalledWith({
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
    prismaMock.membership.findUnique.mockResolvedValue(null);

    await expect(service.getActiveMembership('user-123', 'workspace-123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when the membership is not active', async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.TEACHER,
      status: MembershipStatus.SUSPENDED,
    });

    await expect(service.getActiveMembership('user-123', 'workspace-123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a role in the required list', async () => {
    const membership = {
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    };

    prismaMock.membership.findUnique.mockResolvedValue(membership);

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

    prismaMock.membership.findUnique.mockResolvedValue(membership);

    await expect(
      service.requireRoles('user-123', 'workspace-123', [WorkspaceRole.TEACHER]),
    ).resolves.toEqual(membership);
  });

  it('rejects a role that is not in the required list', async () => {
    prismaMock.membership.findUnique.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.STUDENT,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      service.requireRoles('user-123', 'workspace-123', [WorkspaceRole.ADMIN]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
