import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AttendanceStatus,
  AuditEventType,
  ClassStatus,
  EnrollmentStatus,
  MembershipStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { AttendanceService } from './attendance.service.js';
import type { SaveAttendanceDto } from './dto/save-attendance.dto.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const CLASS_ID = 'class-123';
const SESSION_ID = 'session-123';
const ADMIN_MEMBERSHIP_ID = 'membership-admin';
const TEACHER_MEMBERSHIP_ID = 'membership-teacher';
const STUDENT_ONE = 'student-1';
const STUDENT_TWO = 'student-2';
const DATE = '2026-11-13';

const roster = [
  {
    student: {
      id: STUDENT_ONE,
      studentCode: 'S-001',
      firstName: 'Amara',
      lastName: 'Silva',
    },
  },
  {
    student: {
      id: STUDENT_TWO,
      studentCode: 'S-002',
      firstName: 'Binod',
      lastName: 'Fernando',
    },
  },
];

interface StoredRecord {
  studentId: string;
  status: AttendanceStatus;
  note: string | null;
}

interface StoredSession {
  id: string;
  classId: string;
  sessionDate: Date;
  recordedByMembershipId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function recordedByFor(membershipId: string | null) {
  return membershipId
    ? { id: membershipId, user: { firstName: 'Sarath', lastName: 'Admin' } }
    : null;
}

function saveBody(overrides: Partial<SaveAttendanceDto> = {}): SaveAttendanceDto {
  return {
    date: DATE,
    records: [
      { studentId: STUDENT_ONE, status: AttendanceStatus.PRESENT, note: undefined },
      { studentId: STUDENT_TWO, status: AttendanceStatus.ABSENT, note: 'Sick' },
    ],
    ...overrides,
  };
}

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('AttendanceService', () => {
  let storedSession: StoredSession | null;
  let storedRecords: StoredRecord[];
  let enrolledStudentIds: Set<string>;
  let classStatus: ClassStatus;
  let classExists: boolean;
  let teacherAssigned: boolean;
  let actorRole: WorkspaceRole;

  const now = new Date('2026-11-13T09:00:00.000Z');

  const tx = {
    class: { findFirst: vi.fn() },
    classTeacher: { findFirst: vi.fn() },
    student: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn() },
    attendanceSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    attendanceRecord: {
      findMany: vi.fn(),
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

  let service: AttendanceService;

  beforeEach(() => {
    vi.resetAllMocks();

    storedSession = null;
    storedRecords = [];
    enrolledStudentIds = new Set([STUDENT_ONE, STUDENT_TWO]);
    classStatus = ClassStatus.ACTIVE;
    classExists = true;
    teacherAssigned = true;
    actorRole = WorkspaceRole.ADMIN;

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    workspaceAccessMock.requireRoles.mockImplementation(async () => {
      const teacher = actorRole === WorkspaceRole.TEACHER;

      return {
        id: teacher ? TEACHER_MEMBERSHIP_ID : ADMIN_MEMBERSHIP_ID,
        role: actorRole,
        status: MembershipStatus.ACTIVE,
      };
    });

    tx.class.findFirst.mockImplementation(async () =>
      classExists ? { id: CLASS_ID, status: classStatus } : null,
    );

    tx.classTeacher.findFirst.mockImplementation(async () =>
      teacherAssigned ? { id: 'assignment-1' } : null,
    );

    tx.student.findFirst.mockImplementation(async ({ where }: { where?: { id?: string } }) =>
      where?.id === STUDENT_ONE || where?.id === STUDENT_TWO ? { id: where.id } : null,
    );

    tx.attendanceSession.findMany.mockResolvedValue([]);

    tx.enrollment.findMany.mockImplementation(
      async ({ where }: { where?: { studentId?: { in?: string[] } } }) => {
        if (where?.studentId?.in) {
          return where.studentId.in
            .filter((studentId) => enrolledStudentIds.has(studentId))
            .map((studentId) => ({ studentId }));
        }

        return roster
          .filter(({ student }) => enrolledStudentIds.has(student.id))
          .map(({ student }) => ({ studentId: student.id, student }));
      },
    );

    tx.attendanceSession.findUnique.mockImplementation(async () =>
      storedSession ? { id: storedSession.id } : null,
    );

    tx.attendanceSession.findFirst.mockImplementation(async () =>
      storedSession
        ? {
            id: storedSession.id,
            classId: storedSession.classId,
            sessionDate: storedSession.sessionDate,
            createdAt: storedSession.createdAt,
            updatedAt: storedSession.updatedAt,
            recordedBy: recordedByFor(storedSession.recordedByMembershipId),
          }
        : null,
    );

    tx.attendanceSession.create.mockImplementation(
      async ({
        data,
      }: {
        data: {
          classId: string;
          sessionDate: Date;
          recordedByMembershipId: string | null;
        };
      }) => {
        storedSession = {
          id: SESSION_ID,
          classId: data.classId,
          sessionDate: data.sessionDate,
          recordedByMembershipId: data.recordedByMembershipId,
          createdAt: now,
          updatedAt: now,
        };

        return { id: SESSION_ID };
      },
    );

    tx.attendanceSession.update.mockImplementation(
      async ({ data }: { data: { recordedByMembershipId?: string } }) => {
        if (storedSession && data.recordedByMembershipId) {
          storedSession.recordedByMembershipId = data.recordedByMembershipId;
        }

        return { id: storedSession?.id ?? SESSION_ID };
      },
    );

    tx.attendanceRecord.findMany.mockImplementation(async () =>
      storedRecords.map((record) => ({ ...record })),
    );

    tx.attendanceRecord.create.mockImplementation(async ({ data }: { data: StoredRecord }) => {
      storedRecords.push({
        studentId: data.studentId,
        status: data.status,
        note: data.note ?? null,
      });

      return { id: `record-${storedRecords.length}` };
    });

    tx.attendanceRecord.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { sessionId_studentId: { studentId: string } };
        data: { status: AttendanceStatus; note: string | null };
      }) => {
        const record = storedRecords.find(
          (item) => item.studentId === where.sessionId_studentId.studentId,
        );

        if (record) {
          record.status = data.status;
          record.note = data.note;
        }

        return record;
      },
    );

    service = new AttendanceService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('getRegister', () => {
    it('returns the active roster unmarked when nothing has been saved', async () => {
      const register = await service.getRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, DATE);

      expect(register.date).toBe(DATE);
      expect(register.session).toBeNull();
      expect(register.students).toEqual([
        {
          studentId: STUDENT_ONE,
          studentCode: 'S-001',
          firstName: 'Amara',
          lastName: 'Silva',
          status: null,
          note: null,
        },
        {
          studentId: STUDENT_TWO,
          studentCode: 'S-002',
          firstName: 'Binod',
          lastName: 'Fernando',
          status: null,
          note: null,
        },
      ]);
      expect(register.counts).toEqual({
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        unmarked: 2,
      });
      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER],
        tx,
      );
      expect(tx.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID, status: EnrollmentStatus.ACTIVE },
        }),
      );
    });

    it('merges saved statuses and notes into the roster', async () => {
      storedSession = {
        id: SESSION_ID,
        classId: CLASS_ID,
        sessionDate: new Date(`${DATE}T00:00:00.000Z`),
        recordedByMembershipId: ADMIN_MEMBERSHIP_ID,
        createdAt: now,
        updatedAt: now,
      };
      storedRecords = [
        { studentId: STUDENT_ONE, status: AttendanceStatus.LATE, note: 'Traffic' },
        { studentId: STUDENT_TWO, status: AttendanceStatus.EXCUSED, note: null },
      ];

      const register = await service.getRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, DATE);

      expect(register.session).toMatchObject({
        id: SESSION_ID,
        classId: CLASS_ID,
        date: DATE,
        recordedBy: { membershipId: ADMIN_MEMBERSHIP_ID, name: 'Sarath Admin' },
      });
      expect(register.students.map((student) => [student.status, student.note])).toEqual([
        [AttendanceStatus.LATE, 'Traffic'],
        [AttendanceStatus.EXCUSED, null],
      ]);
      expect(register.counts).toEqual({
        present: 0,
        absent: 0,
        late: 1,
        excused: 1,
        unmarked: 0,
      });
    });

    it('rejects a date that is not a real calendar day', async () => {
      await expect(
        service.getRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, '2026-02-31'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('returns 404 when the class does not exist', async () => {
      classExists = false;

      await expect(
        service.getRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, DATE),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('saveRegister', () => {
    it('creates the session, records every mark and audits the first save', async () => {
      const register = await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());

      expect(storedSession).toMatchObject({
        id: SESSION_ID,
        classId: CLASS_ID,
        recordedByMembershipId: ADMIN_MEMBERSHIP_ID,
      });
      expect(storedRecords).toEqual([
        { studentId: STUDENT_ONE, status: AttendanceStatus.PRESENT, note: null },
        { studentId: STUDENT_TWO, status: AttendanceStatus.ABSENT, note: 'Sick' },
      ]);
      expect(register.counts).toEqual({
        present: 1,
        absent: 1,
        late: 0,
        excused: 0,
        unmarked: 0,
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.ATTENDANCE_RECORDED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: SESSION_ID,
        metadata: {
          classId: CLASS_ID,
          date: DATE,
          students: 2,
          changed: 2,
          present: 1,
          absent: 1,
          late: 0,
          excused: 0,
          unmarked: 0,
        },
      });
    });

    it('leaves unchanged marks untouched and skips the audit entry', async () => {
      await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());
      auditMock.record.mockClear();
      tx.attendanceRecord.create.mockClear();
      tx.attendanceRecord.update.mockClear();

      const register = await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());

      expect(tx.attendanceRecord.create).not.toHaveBeenCalled();
      expect(tx.attendanceRecord.update).not.toHaveBeenCalled();
      expect(register.counts.present).toBe(1);
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('updates a changed mark and audits the correction', async () => {
      await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());
      auditMock.record.mockClear();

      const register = await service.saveRegister(
        ACTOR_ID,
        WORKSPACE_ID,
        CLASS_ID,
        saveBody({
          records: [
            { studentId: STUDENT_ONE, status: AttendanceStatus.LATE, note: 'Arrived at 8:20' },
            { studentId: STUDENT_TWO, status: AttendanceStatus.ABSENT, note: 'Sick' },
          ],
        }),
      );

      expect(storedRecords[0]).toEqual({
        studentId: STUDENT_ONE,
        status: AttendanceStatus.LATE,
        note: 'Arrived at 8:20',
      });
      expect(register.counts).toMatchObject({ absent: 1, late: 1, present: 0 });
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AuditEventType.ATTENDANCE_UPDATED,
          metadata: expect.objectContaining({
            classId: CLASS_ID,
            date: DATE,
            changed: 1,
            late: 1,
            absent: 1,
          }),
        }),
      );
    });

    it('rejects the same student appearing twice', async () => {
      await expect(
        service.saveRegister(
          ACTOR_ID,
          WORKSPACE_ID,
          CLASS_ID,
          saveBody({
            records: [
              { studentId: STUDENT_ONE, status: AttendanceStatus.PRESENT },
              { studentId: STUDENT_ONE, status: AttendanceStatus.ABSENT },
            ],
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.attendanceSession.create).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('rejects a future date', async () => {
      await expect(
        service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody({ date: futureDate(3) })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('rejects a student who is not actively enrolled', async () => {
      enrolledStudentIds = new Set([STUDENT_ONE]);

      await expect(
        service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody()),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.attendanceSession.create).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('rejects registers for archived classes', async () => {
      classStatus = ClassStatus.ARCHIVED;

      await expect(
        service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.attendanceSession.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the class does not exist', async () => {
      classExists = false;

      await expect(
        service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('blocks teachers who are not assigned to the class', async () => {
      actorRole = WorkspaceRole.TEACHER;
      teacherAssigned = false;

      await expect(
        service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.attendanceSession.create).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('lets an assigned teacher save and records them as the author', async () => {
      actorRole = WorkspaceRole.TEACHER;
      teacherAssigned = true;

      await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());

      expect(tx.classTeacher.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          membershipId: TEACHER_MEMBERSHIP_ID,
          endedAt: null,
        },
        select: { id: true },
      });
      expect(storedSession?.recordedByMembershipId).toBe(TEACHER_MEMBERSHIP_ID);
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: AuditEventType.ATTENDANCE_RECORDED }),
      );
    });

    it('does not check teacher assignments for managers', async () => {
      await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());

      expect(tx.classTeacher.findFirst).not.toHaveBeenCalled();
    });

    it('keeps records of students who have since left the class', async () => {
      await service.saveRegister(ACTOR_ID, WORKSPACE_ID, CLASS_ID, saveBody());
      enrolledStudentIds = new Set([STUDENT_ONE]);

      await service.saveRegister(
        ACTOR_ID,
        WORKSPACE_ID,
        CLASS_ID,
        saveBody({
          records: [{ studentId: STUDENT_ONE, status: AttendanceStatus.PRESENT }],
        }),
      );

      expect(storedRecords).toHaveLength(2);
      expect(storedRecords[1]).toMatchObject({
        studentId: STUDENT_TWO,
        status: AttendanceStatus.ABSENT,
      });
    });
  });

  describe('getClassSummary', () => {
    const amara = { studentCode: 'S-001', firstName: 'Amara', lastName: 'Silva' };
    const binod = { studentCode: 'S-002', firstName: 'Binod', lastName: 'Fernando' };

    it('rates present and late as attended and leaves excused out', async () => {
      tx.attendanceSession.findMany.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);
      tx.attendanceRecord.findMany.mockResolvedValue([
        { studentId: STUDENT_ONE, status: AttendanceStatus.PRESENT, student: amara },
        { studentId: STUDENT_ONE, status: AttendanceStatus.LATE, student: amara },
        { studentId: STUDENT_TWO, status: AttendanceStatus.ABSENT, student: binod },
        { studentId: STUDENT_TWO, status: AttendanceStatus.EXCUSED, student: binod },
      ]);

      const summary = await service.getClassSummary(
        ACTOR_ID,
        WORKSPACE_ID,
        CLASS_ID,
        '2026-11-01',
        '2026-11-30',
      );

      expect(summary).toMatchObject({
        classId: CLASS_ID,
        from: '2026-11-01',
        to: '2026-11-30',
        sessions: 2,
        counts: { present: 1, absent: 1, late: 1, excused: 1 },
        attended: 2,
        rate: 66.7,
      });
      expect(
        summary.students.map((student) => [
          student.studentId,
          student.active,
          student.sessions,
          student.rate,
        ]),
      ).toEqual([
        [STUDENT_TWO, true, 2, 0],
        [STUDENT_ONE, true, 2, 100],
      ]);
      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER],
        tx,
      );
      expect(tx.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: WORKSPACE_ID,
            session: {
              classId: CLASS_ID,
              sessionDate: { gte: expect.any(Date), lte: expect.any(Date) },
            },
          },
        }),
      );
    });

    it('lists students who have left the class as inactive', async () => {
      enrolledStudentIds = new Set([STUDENT_ONE]);
      tx.attendanceSession.findMany.mockResolvedValue([{ id: 'session-1' }]);
      tx.attendanceRecord.findMany.mockResolvedValue([
        { studentId: STUDENT_ONE, status: AttendanceStatus.PRESENT, student: amara },
        { studentId: STUDENT_TWO, status: AttendanceStatus.PRESENT, student: binod },
      ]);

      const summary = await service.getClassSummary(
        ACTOR_ID,
        WORKSPACE_ID,
        CLASS_ID,
        '2026-11-01',
        '2026-11-30',
      );

      expect(
        summary.students.map((student) => [student.studentId, student.active, student.rate]),
      ).toEqual([
        [STUDENT_TWO, false, 100],
        [STUDENT_ONE, true, 100],
      ]);
    });

    it('returns active students with null rates when no register was saved', async () => {
      const summary = await service.getClassSummary(
        ACTOR_ID,
        WORKSPACE_ID,
        CLASS_ID,
        '2026-11-01',
        '2026-11-30',
      );

      expect(summary.sessions).toBe(0);
      expect(summary.rate).toBeNull();
      expect(summary.students.map((student) => [student.sessions, student.rate])).toEqual([
        [0, null],
        [0, null],
      ]);
    });

    it('rejects an inverted or oversized range before touching the tenant', async () => {
      await expect(
        service.getClassSummary(ACTOR_ID, WORKSPACE_ID, CLASS_ID, '2026-12-01', '2026-11-30'),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.getClassSummary(ACTOR_ID, WORKSPACE_ID, CLASS_ID, '2025-01-01', '2026-11-30'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('returns 404 when the class does not exist', async () => {
      classExists = false;

      await expect(
        service.getClassSummary(ACTOR_ID, WORKSPACE_ID, CLASS_ID, '2026-11-01', '2026-11-30'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getStudentSummary', () => {
    it('groups marks by class and applies the same rate rule', async () => {
      tx.attendanceRecord.findMany.mockResolvedValue([
        {
          status: AttendanceStatus.PRESENT,
          session: {
            classId: 'class-maths',
            class: { name: 'Mathematics', status: ClassStatus.ACTIVE },
          },
        },
        {
          status: AttendanceStatus.ABSENT,
          session: {
            classId: 'class-maths',
            class: { name: 'Mathematics', status: ClassStatus.ACTIVE },
          },
        },
        {
          status: AttendanceStatus.LATE,
          session: {
            classId: 'class-science',
            class: { name: 'Science', status: ClassStatus.ARCHIVED },
          },
        },
        {
          status: AttendanceStatus.EXCUSED,
          session: {
            classId: 'class-science',
            class: { name: 'Science', status: ClassStatus.ARCHIVED },
          },
        },
      ]);

      const summary = await service.getStudentSummary(
        ACTOR_ID,
        WORKSPACE_ID,
        STUDENT_ONE,
        '2026-11-01',
        '2026-11-30',
      );

      expect(summary).toMatchObject({
        studentId: STUDENT_ONE,
        from: '2026-11-01',
        to: '2026-11-30',
        sessions: 4,
        counts: { present: 1, absent: 1, late: 1, excused: 1 },
        attended: 2,
        rate: 66.7,
      });
      expect(summary.classes).toEqual([
        {
          classId: 'class-maths',
          className: 'Mathematics',
          classStatus: ClassStatus.ACTIVE,
          sessions: 2,
          counts: { present: 1, absent: 1, late: 0, excused: 0 },
          attended: 1,
          rate: 50,
        },
        {
          classId: 'class-science',
          className: 'Science',
          classStatus: ClassStatus.ARCHIVED,
          sessions: 2,
          counts: { present: 0, absent: 0, late: 1, excused: 1 },
          attended: 1,
          rate: 100,
        },
      ]);
      expect(tx.attendanceRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: WORKSPACE_ID,
            studentId: STUDENT_ONE,
            session: { sessionDate: { gte: expect.any(Date), lte: expect.any(Date) } },
          },
        }),
      );
    });

    it('returns an empty summary when the student has no marks in range', async () => {
      const summary = await service.getStudentSummary(
        ACTOR_ID,
        WORKSPACE_ID,
        STUDENT_ONE,
        '2026-11-01',
        '2026-11-30',
      );

      expect(summary).toMatchObject({ sessions: 0, rate: null, classes: [] });
    });

    it('returns 404 when the student is not in the workspace', async () => {
      tx.student.findFirst.mockResolvedValue(null);

      await expect(
        service.getStudentSummary(ACTOR_ID, WORKSPACE_ID, STUDENT_ONE, '2026-11-01', '2026-11-30'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
