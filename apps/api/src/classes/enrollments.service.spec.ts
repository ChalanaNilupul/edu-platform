import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  EnrollmentStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { EnrollmentsService } from './enrollments.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const CLASS_ID = 'class-123';
const STUDENT_ID = 'student-123';
const ENROLLMENT_ID = 'enrollment-123';

const enrollmentRow = {
  id: ENROLLMENT_ID,
  studentId: STUDENT_ID,
  classId: CLASS_ID,
  status: EnrollmentStatus.ACTIVE,
  enrolledAt: new Date('2026-01-05T00:00:00.000Z'),
  endedAt: null,
  notes: null,
  createdAt: new Date('2026-01-05T10:00:00.000Z'),
  updatedAt: new Date('2026-01-05T10:00:00.000Z'),
  student: {
    id: STUDENT_ID,
    studentCode: 'STU-001',
    firstName: 'Nimal',
    lastName: 'Perera',
  },
  class: {
    id: CLASS_ID,
    name: 'Grade 8 Science',
    grade: 'Grade 8',
    status: ClassStatus.ACTIVE,
    capacity: 30,
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

describe('EnrollmentsService', () => {
  const tx = {
    class: { findFirst: vi.fn() },
    student: { findFirst: vi.fn() },
    enrollment: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
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

  let service: EnrollmentsService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    service = new EnrollmentsService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('listForClass', () => {
    it('checks the class and applies search, status and pagination', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.enrollment.findMany.mockResolvedValue([enrollmentRow]);
      tx.enrollment.count.mockResolvedValue(1);

      const result = await service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        search: ' nimal ',
        status: EnrollmentStatus.ACTIVE,
        page: 2,
        pageSize: 5,
      });

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
      expect(tx.enrollment.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          status: EnrollmentStatus.ACTIVE,
          student: {
            OR: [
              { firstName: { contains: 'nimal', mode: 'insensitive' } },
              { lastName: { contains: 'nimal', mode: 'insensitive' } },
              { studentCode: { contains: 'nimal', mode: 'insensitive' } },
            ],
          },
        },
        select: expect.any(Object),
        orderBy: [{ status: 'asc' }, { student: { firstName: 'asc' } }],
        skip: 5,
        take: 5,
      });
      expect(result).toMatchObject({ page: 2, pageSize: 5, total: 1, totalPages: 1 });
    });

    it('throws when the class is not in the workspace', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(
        service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.enrollment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listForStudent', () => {
    it('returns the enrollment history newest first', async () => {
      tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
      tx.enrollment.findMany.mockResolvedValue([enrollmentRow]);

      const result = await service.listForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID);

      expect(tx.enrollment.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, studentId: STUDENT_ID },
        select: expect.any(Object),
        orderBy: [{ enrolledAt: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result).toEqual([enrollmentRow]);
    });

    it('throws when the student is not in the workspace', async () => {
      tx.student.findFirst.mockResolvedValue(null);

      await expect(
        service.listForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('enroll', () => {
    it('enrolls a student and records an audit event', async () => {
      tx.class.findFirst.mockResolvedValue({
        id: CLASS_ID,
        status: ClassStatus.ACTIVE,
        capacity: 30,
      });
      tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
      tx.enrollment.count.mockResolvedValue(0);
      tx.enrollment.create.mockResolvedValue(enrollmentRow);

      const result = await service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        studentId: STUDENT_ID,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        MANAGE_ROLES,
        tx,
      );
      expect(tx.enrollment.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          studentId: STUDENT_ID,
          enrolledAt: undefined,
          notes: null,
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.STUDENT_ENROLLED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: ENROLLMENT_ID,
        metadata: { classId: CLASS_ID, studentId: STUDENT_ID },
      });
      expect(result).toEqual(enrollmentRow);
    });

    it('honours a supplied enrollment date and notes', async () => {
      tx.class.findFirst.mockResolvedValue({
        id: CLASS_ID,
        status: ClassStatus.ACTIVE,
        capacity: null,
      });
      tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
      tx.enrollment.create.mockResolvedValue(enrollmentRow);

      await service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        studentId: STUDENT_ID,
        enrolledAt: '2025-09-01',
        notes: 'Mid-year transfer',
      });

      expect(tx.enrollment.count).not.toHaveBeenCalled();
      expect(tx.enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enrolledAt: new Date('2025-09-01'),
            notes: 'Mid-year transfer',
          }),
        }),
      );
    });

    it('rejects an archived class', async () => {
      tx.class.findFirst.mockResolvedValue({
        id: CLASS_ID,
        status: ClassStatus.ARCHIVED,
        capacity: null,
      });

      await expect(
        service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { studentId: STUDENT_ID }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.enrollment.create).not.toHaveBeenCalled();
    });

    it('rejects a full class', async () => {
      tx.class.findFirst.mockResolvedValue({
        id: CLASS_ID,
        status: ClassStatus.ACTIVE,
        capacity: 2,
      });
      tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
      tx.enrollment.count.mockResolvedValue(2);

      await expect(
        service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { studentId: STUDENT_ID }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.enrollment.create).not.toHaveBeenCalled();
    });

    it('throws when the class or student is missing', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(
        service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { studentId: STUDENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);

      tx.class.findFirst.mockResolvedValue({
        id: CLASS_ID,
        status: ClassStatus.ACTIVE,
        capacity: null,
      });
      tx.student.findFirst.mockResolvedValue(null);

      await expect(
        service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { studentId: STUDENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate active enrollment', async () => {
      tx.class.findFirst.mockResolvedValue({
        id: CLASS_ID,
        status: ClassStatus.ACTIVE,
        capacity: null,
      });
      tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });
      tx.enrollment.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.enroll(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { studentId: STUDENT_ID }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects an empty payload', async () => {
      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('writes nothing and audits nothing when nothing changed', async () => {
      tx.enrollment.findFirst.mockResolvedValue(enrollmentRow);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
        status: EnrollmentStatus.ACTIVE,
        notes: null,
      });

      expect(tx.enrollment.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result).toEqual(enrollmentRow);
    });

    it('completes an enrollment with an end date and audits the transition', async () => {
      tx.enrollment.findFirst.mockResolvedValue(enrollmentRow);
      tx.enrollment.update.mockResolvedValue({
        ...enrollmentRow,
        status: EnrollmentStatus.COMPLETED,
        endedAt: new Date(),
      });

      await service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
        status: EnrollmentStatus.COMPLETED,
      });

      expect(tx.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ENROLLMENT_ID },
          data: { status: EnrollmentStatus.COMPLETED, endedAt: expect.any(Date) },
        }),
      );
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.ENROLLMENT_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: ENROLLMENT_ID,
        metadata: {
          classId: CLASS_ID,
          studentId: STUDENT_ID,
          fields: ['status', 'endedAt'],
          from: EnrollmentStatus.ACTIVE,
          to: EnrollmentStatus.COMPLETED,
        },
      });
    });

    it('uses a supplied end date', async () => {
      tx.enrollment.findFirst.mockResolvedValue(enrollmentRow);
      tx.enrollment.update.mockResolvedValue({
        ...enrollmentRow,
        status: EnrollmentStatus.WITHDRAWN,
        endedAt: new Date('2026-02-01'),
        notes: 'Moved city',
      });

      await service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
        status: EnrollmentStatus.WITHDRAWN,
        endedAt: '2026-02-01',
        notes: 'Moved city',
      });

      expect(tx.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: EnrollmentStatus.WITHDRAWN,
            notes: 'Moved city',
            endedAt: new Date('2026-02-01'),
          },
        }),
      );
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ fields: ['status', 'notes', 'endedAt'] }),
        }),
      );
    });

    it('audits a notes-only edit without touching the status', async () => {
      tx.enrollment.findFirst.mockResolvedValue(enrollmentRow);
      tx.enrollment.update.mockResolvedValue({ ...enrollmentRow, notes: 'Needs support' });

      await service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, { notes: 'Needs support' });

      expect(tx.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { notes: 'Needs support' } }),
      );
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.ENROLLMENT_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: ENROLLMENT_ID,
        metadata: {
          classId: CLASS_ID,
          studentId: STUDENT_ID,
          fields: ['notes'],
        },
      });
    });

    it('reactivates an enrollment and clears the end date', async () => {
      tx.enrollment.findFirst.mockResolvedValue({
        ...enrollmentRow,
        status: EnrollmentStatus.COMPLETED,
        endedAt: new Date('2026-02-01'),
      });
      tx.enrollment.count.mockResolvedValue(3);
      tx.enrollment.update.mockResolvedValue({ ...enrollmentRow, endedAt: null });

      await service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
        status: EnrollmentStatus.ACTIVE,
      });

      expect(tx.enrollment.count).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          status: EnrollmentStatus.ACTIVE,
          id: { not: ENROLLMENT_ID },
        },
      });
      expect(tx.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: EnrollmentStatus.ACTIVE, endedAt: null },
        }),
      );
    });

    it('refuses to reactivate into an archived or full class', async () => {
      tx.enrollment.findFirst.mockResolvedValue({
        ...enrollmentRow,
        status: EnrollmentStatus.COMPLETED,
        endedAt: new Date('2026-02-01'),
        class: { ...enrollmentRow.class, status: ClassStatus.ARCHIVED },
      });

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
          status: EnrollmentStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      tx.enrollment.findFirst.mockResolvedValue({
        ...enrollmentRow,
        status: EnrollmentStatus.COMPLETED,
        endedAt: new Date('2026-02-01'),
        class: { ...enrollmentRow.class, capacity: 4 },
      });
      tx.enrollment.count.mockResolvedValue(4);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
          status: EnrollmentStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.enrollment.update).not.toHaveBeenCalled();
    });

    it('rejects a reactivation that collides with another active enrollment', async () => {
      tx.enrollment.findFirst.mockResolvedValue({
        ...enrollmentRow,
        status: EnrollmentStatus.COMPLETED,
        endedAt: new Date('2026-02-01'),
      });
      tx.enrollment.count.mockResolvedValue(0);
      tx.enrollment.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
          status: EnrollmentStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws when the enrollment is missing', async () => {
      tx.enrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, ENROLLMENT_ID, {
          status: EnrollmentStatus.COMPLETED,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
