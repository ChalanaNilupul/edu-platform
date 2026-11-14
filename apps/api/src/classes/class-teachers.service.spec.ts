import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  MembershipStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { ClassTeachersService } from './class-teachers.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const CLASS_ID = 'class-123';
const MEMBERSHIP_ID = 'membership-123';
const ASSIGNMENT_ID = 'assignment-123';

const assignmentRow = {
  id: ASSIGNMENT_ID,
  classId: CLASS_ID,
  membershipId: MEMBERSHIP_ID,
  isPrimary: true,
  assignedAt: new Date('2026-01-05T00:00:00.000Z'),
  endedAt: null,
  createdAt: new Date('2026-01-05T10:00:00.000Z'),
  updatedAt: new Date('2026-01-05T10:00:00.000Z'),
  class: {
    id: CLASS_ID,
    name: 'Grade 8 Science',
    grade: 'Grade 8',
    status: ClassStatus.ACTIVE,
  },
  membership: {
    id: MEMBERSHIP_ID,
    role: WorkspaceRole.TEACHER,
    status: MembershipStatus.ACTIVE,
    user: {
      id: 'user-teacher',
      firstName: 'Nimal',
      lastName: 'Perera',
      email: 'nimal@example.com',
    },
    teacherProfile: { specializations: ['Mathematics'] },
  },
};

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
  });
}

describe('ClassTeachersService', () => {
  const tx = {
    class: { findFirst: vi.fn() },
    membership: { findFirst: vi.fn() },
    classTeacher: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

  let service: ClassTeachersService;

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

    service = new ClassTeachersService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('listForClass', () => {
    it('returns active assignments and only includes history when asked', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.classTeacher.findMany.mockResolvedValue([assignmentRow]);

      const result = await service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {});

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        READ_ROLES,
        tx,
      );
      expect(tx.class.findFirst).toHaveBeenCalledWith({
        where: { id: CLASS_ID, workspaceId: WORKSPACE_ID },
        select: { id: true },
      });
      expect(tx.classTeacher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID, endedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
        }),
      );
      expect(tx.classTeacher.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [assignmentRow], past: [] });
    });

    it('loads ended assignments when includeEnded is set', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.classTeacher.findMany.mockResolvedValueOnce([assignmentRow]).mockResolvedValueOnce([]);

      await service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { includeEnded: true });

      expect(tx.classTeacher.findMany).toHaveBeenCalledTimes(2);
      expect(tx.classTeacher.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID, endedAt: { not: null } },
        }),
      );
    });

    it('keeps history hidden from teachers even when includeEnded is set', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'teacher-membership',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.classTeacher.findMany.mockResolvedValue([assignmentRow]);

      const result = await service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        includeEnded: true,
      });

      expect(tx.classTeacher.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [assignmentRow], past: [] });
    });

    it('returns 404 for a class outside the workspace', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listForTeacher', () => {
    it('hides past classes from non-managers', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'teacher-membership',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });
      tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
      tx.classTeacher.findMany.mockResolvedValue([assignmentRow]);

      const result = await service.listForTeacher(ACTOR_ID, WORKSPACE_ID, MEMBERSHIP_ID);

      expect(tx.membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: MEMBERSHIP_ID,
            workspaceId: WORKSPACE_ID,
            AND: [
              {
                OR: [{ role: WorkspaceRole.TEACHER }, { teacherProfile: { isNot: null } }],
              },
            ],
          },
        }),
      );
      expect(tx.classTeacher.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ items: [assignmentRow], past: [] });
    });

    it('includes past classes for managers', async () => {
      tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
      tx.classTeacher.findMany.mockResolvedValueOnce([assignmentRow]).mockResolvedValueOnce([]);

      await service.listForTeacher(ACTOR_ID, WORKSPACE_ID, MEMBERSHIP_ID);

      expect(tx.classTeacher.findMany).toHaveBeenCalledTimes(2);
    });

    it('returns 404 when the membership is not a teacher', async () => {
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(service.listForTeacher(ACTOR_ID, WORKSPACE_ID, MEMBERSHIP_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assign', () => {
    it('assigns a teacher as primary and clears the previous primary', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
      tx.classTeacher.findFirst.mockResolvedValue(null);
      tx.classTeacher.create.mockResolvedValue(assignmentRow);

      const result = await service.assign(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        membershipId: MEMBERSHIP_ID,
        isPrimary: true,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        MANAGE_ROLES,
        tx,
      );
      expect(tx.membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: MEMBERSHIP_ID,
            workspaceId: WORKSPACE_ID,
            status: MembershipStatus.ACTIVE,
            AND: [
              {
                OR: [{ role: WorkspaceRole.TEACHER }, { teacherProfile: { isNot: null } }],
              },
            ],
          },
        }),
      );
      expect(tx.classTeacher.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID, endedAt: null, isPrimary: true },
        data: { isPrimary: false },
      });
      expect(tx.classTeacher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            workspaceId: WORKSPACE_ID,
            classId: CLASS_ID,
            membershipId: MEMBERSHIP_ID,
            isPrimary: true,
          },
        }),
      );
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_TEACHER_ASSIGNED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: ASSIGNMENT_ID,
        metadata: { classId: CLASS_ID, membershipId: MEMBERSHIP_ID, isPrimary: true },
      });
      expect(result).toEqual(assignmentRow);
    });

    it('does not touch the primary flag for a normal assignment', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
      tx.classTeacher.findFirst.mockResolvedValue(null);
      tx.classTeacher.create.mockResolvedValue({ ...assignmentRow, isPrimary: false });

      await service.assign(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { membershipId: MEMBERSHIP_ID });

      expect(tx.classTeacher.updateMany).not.toHaveBeenCalled();
    });

    it('rejects archived classes', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ARCHIVED });

      await expect(
        service.assign(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { membershipId: MEMBERSHIP_ID }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a member who is not in the teacher directory', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.assign(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { membershipId: MEMBERSHIP_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate active assignment', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
      tx.classTeacher.findFirst.mockResolvedValue({ id: ASSIGNMENT_ID });

      await expect(
        service.assign(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { membershipId: MEMBERSHIP_ID }),
      ).rejects.toThrow(ConflictException);
      expect(tx.classTeacher.create).not.toHaveBeenCalled();
    });

    it('maps a unique violation to a conflict', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
      tx.classTeacher.findFirst.mockResolvedValue(null);
      tx.classTeacher.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.assign(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { membershipId: MEMBERSHIP_ID }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('makes an assignment primary and clears the previous primary', async () => {
      tx.classTeacher.findFirst.mockResolvedValue({ ...assignmentRow, isPrimary: false });
      tx.classTeacher.update.mockResolvedValue(assignmentRow);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID, {
        isPrimary: true,
      });

      expect(tx.classTeacher.updateMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          endedAt: null,
          isPrimary: true,
          id: { not: ASSIGNMENT_ID },
        },
        data: { isPrimary: false },
      });
      expect(tx.classTeacher.update).toHaveBeenCalledWith({
        where: { id: ASSIGNMENT_ID },
        data: { isPrimary: true },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_TEACHER_PRIMARY_CHANGED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: ASSIGNMENT_ID,
        metadata: { classId: CLASS_ID, membershipId: MEMBERSHIP_ID, isPrimary: true },
      });
      expect(result).toEqual(assignmentRow);
    });

    it('writes no audit event when the flag is unchanged', async () => {
      tx.classTeacher.findFirst.mockResolvedValue(assignmentRow);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID, {
        isPrimary: true,
      });

      expect(tx.classTeacher.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result).toEqual(assignmentRow);
    });

    it('rejects ended assignments', async () => {
      tx.classTeacher.findFirst.mockResolvedValue({
        ...assignmentRow,
        endedAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID, { isPrimary: false }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns 404 when the assignment is not in the class', async () => {
      tx.classTeacher.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID, { isPrimary: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('ends the assignment instead of deleting it', async () => {
      const ended = { ...assignmentRow, endedAt: new Date('2026-02-01T00:00:00.000Z') };
      tx.classTeacher.findFirst.mockResolvedValue(assignmentRow);
      tx.classTeacher.update.mockResolvedValue(ended);

      const result = await service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID);

      expect(tx.classTeacher.update).toHaveBeenCalledWith({
        where: { id: ASSIGNMENT_ID },
        data: { endedAt: expect.any(Date) },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_TEACHER_REMOVED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: ASSIGNMENT_ID,
        metadata: {
          classId: CLASS_ID,
          membershipId: MEMBERSHIP_ID,
          endedAt: '2026-02-01T00:00:00.000Z',
        },
      });
      expect(result).toEqual(ended);
    });

    it('rejects an assignment that already ended', async () => {
      tx.classTeacher.findFirst.mockResolvedValue({
        ...assignmentRow,
        endedAt: new Date('2026-02-01T00:00:00.000Z'),
      });

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.classTeacher.update).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown assignment', async () => {
      tx.classTeacher.findFirst.mockResolvedValue(null);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID, ASSIGNMENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
