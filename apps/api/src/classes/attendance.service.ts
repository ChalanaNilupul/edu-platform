import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  AttendanceStatus,
  AuditEventType,
  ClassStatus,
  EnrollmentStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import type { ActiveMembership } from '../workspaces/workspace-access.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { AttendanceRecordDto, SaveAttendanceDto } from './dto/save-attendance.dto.js';

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const WRITE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];

// One day of slack lets workspaces ahead of UTC save their local "today"
// without needing a timezone setting.
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

const sessionSelect = {
  id: true,
  classId: true,
  sessionDate: true,
  createdAt: true,
  updatedAt: true,
  recordedBy: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.AttendanceSessionSelect;

type SessionRow = Prisma.AttendanceSessionGetPayload<{ select: typeof sessionSelect }>;

interface NormalisedRecord {
  studentId: string;
  status: AttendanceStatus;
  note: string | null;
}

export type AttendanceSessionView = {
  id: string;
  classId: string;
  date: string;
  recordedBy: { membershipId: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceStudentView = {
  studentId: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
  status: AttendanceStatus | null;
  note: string | null;
};

export type AttendanceCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
};

export type AttendanceRegisterView = {
  date: string;
  session: AttendanceSessionView | null;
  students: AttendanceStudentView[];
  counts: AttendanceCounts;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseRegisterDate(value: string): Date {
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? Number.NaN;
  const month = parts[1] ?? Number.NaN;
  const day = parts[2] ?? Number.NaN;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException('date must be a real calendar date');
  }

  return date;
}

function utcToday(): Date {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.length === 0) {
    return null;
  }

  return value;
}

function normaliseRecords(records: AttendanceRecordDto[]): NormalisedRecord[] {
  const seen = new Set<string>();

  return records.map((record) => {
    if (seen.has(record.studentId)) {
      throw new BadRequestException('Each student can only appear once in a register');
    }

    seen.add(record.studentId);

    return {
      studentId: record.studentId,
      status: record.status,
      note: nullableText(record.note),
    };
  });
}

function toSessionView(session: SessionRow): AttendanceSessionView {
  const recordedBy = session.recordedBy
    ? {
        membershipId: session.recordedBy.id,
        name: [session.recordedBy.user.firstName, session.recordedBy.user.lastName]
          .filter((part): part is string => Boolean(part))
          .join(' '),
      }
    : null;

  return {
    id: session.id,
    classId: session.classId,
    date: formatDate(session.sessionDate),
    recordedBy,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function tally(students: AttendanceStudentView[]): AttendanceCounts {
  const counts: AttendanceCounts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };

  for (const student of students) {
    switch (student.status) {
      case AttendanceStatus.PRESENT:
        counts.present += 1;
        break;
      case AttendanceStatus.ABSENT:
        counts.absent += 1;
        break;
      case AttendanceStatus.LATE:
        counts.late += 1;
        break;
      case AttendanceStatus.EXCUSED:
        counts.excused += 1;
        break;
      default:
        counts.unmarked += 1;
    }
  }

  return counts;
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async getRegister(actorId: string, workspaceId: string, classId: string, date: string) {
    const sessionDate = parseRegisterDate(date);

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);
      await this.requireClass(tx, workspaceId, classId);

      return this.readRegister(tx, workspaceId, classId, sessionDate);
    });
  }

  async saveRegister(
    actorId: string,
    workspaceId: string,
    classId: string,
    dto: SaveAttendanceDto,
  ) {
    const sessionDate = parseRegisterDate(dto.date);
    const records = normaliseRecords(dto.records);

    if (sessionDate.getTime() > utcToday().getTime() + FUTURE_SLACK_MS) {
      throw new BadRequestException('Attendance cannot be recorded for a future date');
    }

    const outcome = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const schoolClass = await this.requireClass(tx, workspaceId, classId);
      await this.requireWriter(tx, workspaceId, classId, membership);

      if (schoolClass.status !== ClassStatus.ACTIVE) {
        throw new ConflictException('Archived classes cannot record attendance');
      }

      await this.ensureActiveEnrollments(tx, workspaceId, classId, records);

      const existing = await tx.attendanceSession.findUnique({
        where: { classId_sessionDate: { classId, sessionDate } },
        select: { id: true },
      });

      const sessionId = existing
        ? (
            await tx.attendanceSession.update({
              where: { id: existing.id },
              data: { recordedByMembershipId: membership.id },
              select: { id: true },
            })
          ).id
        : (
            await tx.attendanceSession.create({
              data: {
                workspaceId,
                classId,
                sessionDate,
                recordedByMembershipId: membership.id,
              },
              select: { id: true },
            })
          ).id;

      const previous = await tx.attendanceRecord.findMany({
        where: { workspaceId, sessionId },
        select: { studentId: true, status: true, note: true },
      });
      const previousByStudent = new Map(previous.map((record) => [record.studentId, record]));

      let changed = 0;

      for (const record of records) {
        const before = previousByStudent.get(record.studentId);

        if (!before) {
          await tx.attendanceRecord.create({
            data: { workspaceId, sessionId, ...record },
          });
          changed += 1;
          continue;
        }

        if (before.status === record.status && before.note === record.note) {
          continue;
        }

        await tx.attendanceRecord.update({
          where: {
            sessionId_studentId: { sessionId, studentId: record.studentId },
          },
          data: { status: record.status, note: record.note },
        });
        changed += 1;
      }

      const register = await this.readRegister(tx, workspaceId, classId, sessionDate);

      return { register, created: existing === null, changed };
    });

    if (outcome.created || outcome.changed > 0) {
      await this.audit.record({
        type: outcome.created
          ? AuditEventType.ATTENDANCE_RECORDED
          : AuditEventType.ATTENDANCE_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: outcome.register.session?.id ?? null,
        metadata: {
          classId,
          date: outcome.register.date,
          students: records.length,
          changed: outcome.changed,
          ...outcome.register.counts,
        },
      });
    }

    return outcome.register;
  }

  private async readRegister(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
    sessionDate: Date,
  ): Promise<AttendanceRegisterView> {
    const [session, enrollments] = await Promise.all([
      tx.attendanceSession.findFirst({
        where: { workspaceId, classId, sessionDate },
        select: sessionSelect,
      }),
      tx.enrollment.findMany({
        where: { workspaceId, classId, status: EnrollmentStatus.ACTIVE },
        select: {
          student: {
            select: { id: true, studentCode: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      }),
    ]);

    const records = session
      ? await tx.attendanceRecord.findMany({
          where: { workspaceId, sessionId: session.id },
          select: { studentId: true, status: true, note: true },
        })
      : [];
    const recordByStudent = new Map(records.map((record) => [record.studentId, record]));

    const students: AttendanceStudentView[] = enrollments.map(({ student }) => {
      const record = recordByStudent.get(student.id);

      return {
        studentId: student.id,
        studentCode: student.studentCode,
        firstName: student.firstName,
        lastName: student.lastName,
        status: record?.status ?? null,
        note: record?.note ?? null,
      };
    });

    return {
      date: formatDate(sessionDate),
      session: session ? toSessionView(session) : null,
      students,
      counts: tally(students),
    };
  }

  private async requireClass(tx: Prisma.TransactionClient, workspaceId: string, classId: string) {
    const schoolClass = await tx.class.findFirst({
      where: { id: classId, workspaceId },
      select: { id: true, status: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  private async requireWriter(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
    membership: ActiveMembership,
  ) {
    if (membership.role !== WorkspaceRole.TEACHER) {
      return;
    }

    const assignment = await tx.classTeacher.findFirst({
      where: { workspaceId, classId, membershipId: membership.id, endedAt: null },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException("Only this class's teachers can record attendance");
    }
  }

  private async ensureActiveEnrollments(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
    records: NormalisedRecord[],
  ) {
    const active = await tx.enrollment.findMany({
      where: {
        workspaceId,
        classId,
        status: EnrollmentStatus.ACTIVE,
        studentId: { in: records.map((record) => record.studentId) },
      },
      select: { studentId: true },
    });

    if (active.length !== records.length) {
      throw new BadRequestException(
        'Every student in a register must be actively enrolled in the class',
      );
    }
  }
}
