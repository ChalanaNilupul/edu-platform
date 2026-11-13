import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import { AuditEventType, MembershipStatus, WorkspaceRole } from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { TeachersService } from './teachers.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const OWNER_MEMBERSHIP_ID = 'membership-owner';
const TEACHER_MEMBERSHIP_ID = 'membership-teacher';

const teacherRow = {
  id: TEACHER_MEMBERSHIP_ID,
  role: WorkspaceRole.TEACHER,
  status: MembershipStatus.ACTIVE,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  user: {
    id: 'user-teacher',
    firstName: 'Nimal',
    lastName: 'Perera',
    email: 'nimal@example.com',
  },
  teacherProfile: null,
};

const profileRow = {
  id: 'profile-123',
  phone: '0771234567',
  qualifications: 'B.Sc. Mathematics',
  specializations: ['Mathematics', 'Physics'],
  bio: 'Senior teacher',
  joinedAt: new Date('2025-01-15T00:00:00.000Z'),
  notes: null,
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('TeachersService', () => {
  const tx = {
    membership: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    teacherProfile: {
      create: vi.fn(),
      update: vi.fn(),
    },
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

  const auditMock = {
    record: vi.fn(),
  };

  let service: TeachersService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    workspaceAccessMock.requireRoles.mockResolvedValue({
      id: ACTOR_ID,
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });

    service = new TeachersService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('list', () => {
    it('requires a staff role and lists teachers plus profiled members', async () => {
      tx.membership.findMany.mockResolvedValue([teacherRow]);
      tx.membership.count.mockResolvedValue(1);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, {});

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER],
        tx,
      );
      expect(tx.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: WORKSPACE_ID,
            AND: [
              {
                OR: [{ role: WorkspaceRole.TEACHER }, { teacherProfile: { isNot: null } }],
              },
            ],
          },
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({
        items: [teacherRow],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('applies search, status and pagination', async () => {
      tx.membership.findMany.mockResolvedValue([]);
      tx.membership.count.mockResolvedValue(0);

      await service.list(ACTOR_ID, WORKSPACE_ID, {
        search: '  nimal ',
        status: MembershipStatus.SUSPENDED,
        page: 2,
        pageSize: 10,
      });

      const call = tx.membership.findMany.mock.calls[0]![0]!;

      expect(call.skip).toBe(10);
      expect(call.take).toBe(10);
      expect(call.where.AND).toHaveLength(3);
      expect(call.where.AND[1]).toEqual({ status: MembershipStatus.SUSPENDED });
      expect(call.where.AND[2].OR).toEqual(
        expect.arrayContaining([
          { user: { firstName: { contains: 'nimal', mode: 'insensitive' } } },
        ]),
      );
    });

    it('caps the page size', async () => {
      tx.membership.findMany.mockResolvedValue([]);
      tx.membership.count.mockResolvedValue(0);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, { pageSize: 500 });

      expect(result.pageSize).toBe(100);
    });
  });

  describe('findOne', () => {
    it('returns a teacher in the workspace', async () => {
      tx.membership.findFirst.mockResolvedValue(teacherRow);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, TEACHER_MEMBERSHIP_ID)).resolves.toBe(
        teacherRow,
      );
    });

    it('returns 404 for an unknown or non-teaching membership', async () => {
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('upsertProfile', () => {
    it('rejects an empty payload before opening a transaction', async () => {
      await expect(
        service.upsertProfile(ACTOR_ID, WORKSPACE_ID, TEACHER_MEMBERSHIP_ID, {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('creates a profile and audits the creation', async () => {
      workspaceAccessMock.getActiveMembership.mockResolvedValue({
        id: OWNER_MEMBERSHIP_ID,
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.membership.findFirst.mockResolvedValue({
        id: TEACHER_MEMBERSHIP_ID,
        teacherProfile: null,
      });
      tx.teacherProfile.create.mockResolvedValue(profileRow);

      const result = await service.upsertProfile(ACTOR_ID, WORKSPACE_ID, TEACHER_MEMBERSHIP_ID, {
        phone: ' 0771234567 ',
        qualifications: 'B.Sc. Mathematics',
        specializations: [' Mathematics ', 'Physics', 'Mathematics', ' '],
      });

      expect(tx.teacherProfile.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          membershipId: TEACHER_MEMBERSHIP_ID,
          phone: '0771234567',
          qualifications: 'B.Sc. Mathematics',
          specializations: ['Mathematics', 'Physics'],
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.TEACHER_PROFILE_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: TEACHER_MEMBERSHIP_ID,
        metadata: { fields: ['phone', 'qualifications', 'specializations'] },
      });
      expect(result).toBe(profileRow);
    });

    it('updates an existing profile and clears nullable fields with null', async () => {
      workspaceAccessMock.getActiveMembership.mockResolvedValue({
        id: OWNER_MEMBERSHIP_ID,
        role: WorkspaceRole.BRANCH_MANAGER,
        status: MembershipStatus.ACTIVE,
      });
      tx.membership.findFirst.mockResolvedValue({
        id: TEACHER_MEMBERSHIP_ID,
        teacherProfile: { id: 'profile-123' },
      });
      tx.teacherProfile.update.mockResolvedValue({ ...profileRow, phone: null });

      await service.upsertProfile(ACTOR_ID, WORKSPACE_ID, TEACHER_MEMBERSHIP_ID, {
        phone: null,
        notes: '',
        joinedAt: '2025-01-15',
      });

      expect(tx.teacherProfile.update).toHaveBeenCalledWith({
        where: { id: 'profile-123' },
        data: {
          phone: null,
          joinedAt: new Date('2025-01-15'),
          notes: null,
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: AuditEventType.TEACHER_PROFILE_UPDATED }),
      );
    });

    it('lets a teacher edit their own profile', async () => {
      workspaceAccessMock.getActiveMembership.mockResolvedValue({
        id: TEACHER_MEMBERSHIP_ID,
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });
      tx.membership.findFirst.mockResolvedValue({
        id: TEACHER_MEMBERSHIP_ID,
        teacherProfile: { id: 'profile-123' },
      });
      tx.teacherProfile.update.mockResolvedValue(profileRow);

      await expect(
        service.upsertProfile(ACTOR_ID, WORKSPACE_ID, TEACHER_MEMBERSHIP_ID, {
          bio: 'Updated bio',
        }),
      ).resolves.toBe(profileRow);
    });

    it('blocks a teacher from editing another member profile', async () => {
      workspaceAccessMock.getActiveMembership.mockResolvedValue({
        id: OWNER_MEMBERSHIP_ID,
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });

      await expect(
        service.upsertProfile(ACTOR_ID, WORKSPACE_ID, TEACHER_MEMBERSHIP_ID, {
          bio: 'Updated bio',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tx.membership.findFirst).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('returns 404 for a membership outside the workspace', async () => {
      workspaceAccessMock.getActiveMembership.mockResolvedValue({
        id: OWNER_MEMBERSHIP_ID,
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertProfile(ACTOR_ID, WORKSPACE_ID, 'missing', { bio: 'Hello' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
