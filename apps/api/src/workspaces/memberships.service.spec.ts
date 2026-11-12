import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MembershipsService } from './memberships.service.js';
import type { WorkspaceAccessService } from './workspace-access.service.js';

describe('MembershipsService', () => {
  const prismaMock = {
    membership: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const workspaceAccessMock = {
    getActiveMembership: vi.fn(),
    requireRoles: vi.fn(),
  };

  let service: MembershipsService;

  beforeEach(() => {
    vi.resetAllMocks();

    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );

    service = new MembershipsService(
      prismaMock as unknown as PrismaService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
    );
  });

  describe('list', () => {
    it('requires the admin role and returns workspace members', async () => {
      const members = [
        {
          id: 'membership-123',
          role: WorkspaceRole.TEACHER,
          status: MembershipStatus.ACTIVE,
          createdAt: new Date(),
          user: {
            id: 'user-123',
            firstName: 'Chalana',
            lastName: null,
            email: 'test@example.com',
          },
        },
      ];

      prismaMock.membership.findMany.mockResolvedValue(members);

      const result = await service.list('actor-123', 'workspace-123');

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith('actor-123', 'workspace-123', [
        WorkspaceRole.ADMIN,
      ]);
      expect(prismaMock.membership.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
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
      expect(result).toEqual(members);
    });

    it('propagates the access check failure', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(
        new ForbiddenException('You do not have permission to perform this action'),
      );

      await expect(service.list('actor-123', 'workspace-123')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.membership.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    beforeEach(() => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
    });

    it('requires the owner role', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(
        new ForbiddenException('You do not have permission to perform this action'),
      );

      await expect(
        service.updateRole('actor-123', 'workspace-123', 'membership-123', WorkspaceRole.TEACHER),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith('actor-123', 'workspace-123', [
        WorkspaceRole.OWNER,
      ]);
      expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
    });

    it('rejects an unknown membership', async () => {
      prismaMock.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRole('actor-123', 'workspace-123', 'missing', WorkspaceRole.TEACHER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects changing the owner role', async () => {
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'user-456',
        role: WorkspaceRole.OWNER,
      });

      await expect(
        service.updateRole('actor-123', 'workspace-123', 'membership-123', WorkspaceRole.TEACHER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects promoting a member to owner', async () => {
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'user-456',
        role: WorkspaceRole.TEACHER,
      });

      await expect(
        service.updateRole('actor-123', 'workspace-123', 'membership-123', WorkspaceRole.OWNER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects changing your own role', async () => {
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'actor-123',
        role: WorkspaceRole.ADMIN,
      });

      await expect(
        service.updateRole('actor-123', 'workspace-123', 'membership-123', WorkspaceRole.TEACHER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the role of another member', async () => {
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'user-456',
        role: WorkspaceRole.TEACHER,
      });
      prismaMock.membership.update.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });

      const result = await service.updateRole(
        'actor-123',
        'workspace-123',
        'membership-123',
        WorkspaceRole.ADMIN,
      );

      expect(prismaMock.membership.update).toHaveBeenCalledWith({
        where: { id: 'membership-123' },
        data: { role: WorkspaceRole.ADMIN },
        select: {
          id: true,
          role: true,
          status: true,
        },
      });
      expect(result.role).toBe(WorkspaceRole.ADMIN);
    });
  });

  describe('remove', () => {
    it('rejects an unknown membership', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
      prismaMock.membership.findFirst.mockResolvedValue(null);

      await expect(service.remove('actor-123', 'workspace-123', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects removing yourself', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'actor-123',
        role: WorkspaceRole.ADMIN,
      });

      await expect(
        service.remove('actor-123', 'workspace-123', 'membership-123'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects removing the owner', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'user-456',
        role: WorkspaceRole.OWNER,
      });

      await expect(
        service.remove('actor-123', 'workspace-123', 'membership-123'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('prevents an admin from removing another admin', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'user-456',
        role: WorkspaceRole.ADMIN,
      });

      await expect(
        service.remove('actor-123', 'workspace-123', 'membership-123'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.membership.delete).not.toHaveBeenCalled();
    });

    it('deletes the membership and clears the active workspace of the removed user', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'actor-membership',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      prismaMock.membership.findFirst.mockResolvedValue({
        id: 'membership-123',
        userId: 'user-456',
        role: WorkspaceRole.TEACHER,
      });

      const result = await service.remove('actor-123', 'workspace-123', 'membership-123');

      expect(prismaMock.membership.delete).toHaveBeenCalledWith({
        where: { id: 'membership-123' },
      });
      expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-456',
          activeWorkspaceId: 'workspace-123',
        },
        data: { activeWorkspaceId: null },
      });
      expect(result).toEqual({ message: 'Member removed' });
    });
  });
});
