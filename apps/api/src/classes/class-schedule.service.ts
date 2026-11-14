import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  MembershipStatus,
  Prisma,
  SubjectStatus,
  WorkspaceRole,
  type DayOfWeek,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateClassScheduleSlotDto } from './dto/create-class-schedule-slot.dto.js';
import type { UpdateClassScheduleSlotDto } from './dto/update-class-schedule-slot.dto.js';

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const slotSelect = {
  id: true,
  classId: true,
  subjectId: true,
  membershipId: true,
  dayOfWeek: true,
  startMinutes: true,
  endMinutes: true,
  room: true,
  createdAt: true,
  updatedAt: true,
  subject: {
    select: { id: true, name: true, code: true },
  },
  membership: {
    select: {
      id: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ClassScheduleSlotSelect;

export type ClassScheduleSlotView = Prisma.ClassScheduleSlotGetPayload<{
  select: typeof slotSelect;
}>;

interface SlotFields {
  subjectId: string;
  membershipId: string | null;
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
}

function directoryEligibility(): Prisma.MembershipWhereInput {
  return {
    OR: [{ role: WorkspaceRole.TEACHER }, { teacherProfile: { isNot: null } }],
  };
}

function nullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.length === 0) {
    return null;
  }

  return value;
}

function changedSlotFields(existing: ClassScheduleSlotView, data: SlotFields): string[] {
  const fields: (keyof SlotFields)[] = [
    'subjectId',
    'membershipId',
    'dayOfWeek',
    'startMinutes',
    'endMinutes',
    'room',
  ];

  return fields.filter((field) => existing[field] !== data[field]);
}

function isSlotConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;

  if (code === '23P01') {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Driver adapters report exclusion violations as a generic database
    // error (P2039) with the PostgreSQL code nested in the adapter details.
    const details = `${JSON.stringify(error.meta ?? {})} ${error.message}`;

    return details.includes('23P01') || details.includes('class_schedule_slots_no_');
  }

  return false;
}

@Injectable()
export class ClassScheduleService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listForClass(actorId: string, workspaceId: string, classId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const schoolClass = await tx.class.findFirst({
        where: { id: classId, workspaceId },
        select: { id: true },
      });

      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }

      const items = await tx.classScheduleSlot.findMany({
        where: { workspaceId, classId },
        select: slotSelect,
        orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
      });

      return { items };
    });
  }

  async create(
    actorId: string,
    workspaceId: string,
    classId: string,
    dto: CreateClassScheduleSlotDto,
  ) {
    let created: ClassScheduleSlotView;

    try {
      created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);
        await this.requireWritableClass(tx, workspaceId, classId);

        const data: SlotFields = {
          subjectId: dto.subjectId,
          membershipId: dto.membershipId ?? null,
          dayOfWeek: dto.dayOfWeek,
          startMinutes: dto.startMinutes,
          endMinutes: dto.endMinutes,
          room: nullableText(dto.room),
        };

        this.ensureRange(data.startMinutes, data.endMinutes);
        await this.ensureSubject(tx, workspaceId, classId, data.subjectId);
        await this.ensureTeacher(tx, workspaceId, data.membershipId);
        await this.ensureNoOverlap(tx, workspaceId, classId, data);

        return tx.classScheduleSlot.create({
          data: { workspaceId, classId, ...data },
          select: slotSelect,
        });
      });
    } catch (error) {
      if (isSlotConflict(error)) {
        throw new ConflictException('This slot conflicts with an existing slot');
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.CLASS_SCHEDULE_SLOT_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: {
        classId,
        subjectId: created.subjectId,
        membershipId: created.membershipId,
        dayOfWeek: created.dayOfWeek,
        startMinutes: created.startMinutes,
        endMinutes: created.endMinutes,
      },
    });

    return created;
  }

  async update(
    actorId: string,
    workspaceId: string,
    classId: string,
    slotId: string,
    dto: UpdateClassScheduleSlotDto,
  ) {
    let result: { updated: ClassScheduleSlotView; changed: string[] };

    try {
      result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);
        await this.requireWritableClass(tx, workspaceId, classId);

        const existing = await tx.classScheduleSlot.findFirst({
          where: { id: slotId, classId, workspaceId },
          select: slotSelect,
        });

        if (!existing) {
          throw new NotFoundException('Schedule slot not found');
        }

        const data: SlotFields = {
          subjectId: dto.subjectId ?? existing.subjectId,
          membershipId: dto.membershipId !== undefined ? dto.membershipId : existing.membershipId,
          dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
          startMinutes: dto.startMinutes ?? existing.startMinutes,
          endMinutes: dto.endMinutes ?? existing.endMinutes,
          room: dto.room !== undefined ? nullableText(dto.room) : existing.room,
        };

        this.ensureRange(data.startMinutes, data.endMinutes);
        await this.ensureSubject(tx, workspaceId, classId, data.subjectId, existing.subjectId);
        await this.ensureTeacher(tx, workspaceId, data.membershipId);
        await this.ensureNoOverlap(tx, workspaceId, classId, data, existing.id);

        const changed = changedSlotFields(existing, data);

        if (changed.length === 0) {
          return { updated: existing, changed };
        }

        const updated = await tx.classScheduleSlot.update({
          where: { id: existing.id },
          data,
          select: slotSelect,
        });

        return { updated, changed };
      });
    } catch (error) {
      if (isSlotConflict(error)) {
        throw new ConflictException('This slot conflicts with an existing slot');
      }

      throw error;
    }

    if (result.changed.length > 0) {
      await this.audit.record({
        type: AuditEventType.CLASS_SCHEDULE_SLOT_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: slotId,
        metadata: {
          classId,
          subjectId: result.updated.subjectId,
          membershipId: result.updated.membershipId,
          dayOfWeek: result.updated.dayOfWeek,
          startMinutes: result.updated.startMinutes,
          endMinutes: result.updated.endMinutes,
          fields: result.changed,
        },
      });
    }

    return result.updated;
  }

  async remove(actorId: string, workspaceId: string, classId: string, slotId: string) {
    const removed = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);
      await this.requireWritableClass(tx, workspaceId, classId);

      const existing = await tx.classScheduleSlot.findFirst({
        where: { id: slotId, classId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Schedule slot not found');
      }

      return tx.classScheduleSlot.delete({
        where: { id: existing.id },
        select: slotSelect,
      });
    });

    await this.audit.record({
      type: AuditEventType.CLASS_SCHEDULE_SLOT_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: slotId,
      metadata: {
        classId,
        subjectId: removed.subjectId,
        membershipId: removed.membershipId,
        dayOfWeek: removed.dayOfWeek,
        startMinutes: removed.startMinutes,
        endMinutes: removed.endMinutes,
      },
    });

    return removed;
  }

  private async requireWritableClass(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
  ) {
    const schoolClass = await tx.class.findFirst({
      where: { id: classId, workspaceId },
      select: { id: true, status: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    if (schoolClass.status !== ClassStatus.ACTIVE) {
      throw new ConflictException('Archived classes cannot change their timetable');
    }

    return schoolClass;
  }

  private ensureRange(startMinutes: number, endMinutes: number) {
    if (startMinutes >= endMinutes) {
      throw new BadRequestException('End time must be after start time');
    }
  }

  private async ensureSubject(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
    subjectId: string,
    unchangedSubjectId?: string,
  ) {
    if (unchangedSubjectId === subjectId) {
      return;
    }

    const link = await tx.classSubject.findFirst({
      where: { workspaceId, classId, subjectId },
      select: { subject: { select: { status: true } } },
    });

    if (!link) {
      throw new BadRequestException('Subject is not linked to this class');
    }

    if (link.subject.status !== SubjectStatus.ACTIVE) {
      throw new ConflictException('Archived subjects cannot be scheduled');
    }
  }

  private async ensureTeacher(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    membershipId: string | null,
  ) {
    if (!membershipId) {
      return;
    }

    const teacher = await tx.membership.findFirst({
      where: {
        id: membershipId,
        workspaceId,
        status: MembershipStatus.ACTIVE,
        AND: [directoryEligibility()],
      },
      select: { id: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }
  }

  private async ensureNoOverlap(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
    data: SlotFields,
    excludeSlotId?: string,
  ) {
    const classClash = await tx.classScheduleSlot.findFirst({
      where: {
        workspaceId,
        classId,
        dayOfWeek: data.dayOfWeek,
        startMinutes: { lt: data.endMinutes },
        endMinutes: { gt: data.startMinutes },
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      select: { id: true },
    });

    if (classClash) {
      throw new ConflictException('This slot overlaps another slot for this class');
    }

    if (!data.membershipId) {
      return;
    }

    const teacherClash = await tx.classScheduleSlot.findFirst({
      where: {
        workspaceId,
        membershipId: data.membershipId,
        dayOfWeek: data.dayOfWeek,
        startMinutes: { lt: data.endMinutes },
        endMinutes: { gt: data.startMinutes },
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      select: { id: true },
    });

    if (teacherClash) {
      throw new ConflictException('This teacher already has a slot at this time');
    }
  }
}
