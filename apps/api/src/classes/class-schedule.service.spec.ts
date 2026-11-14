import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  DayOfWeek,
  MembershipStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { ClassScheduleService } from './class-schedule.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const CLASS_ID = 'class-123';
const SUBJECT_ID = 'subject-123';
const MEMBERSHIP_ID = 'membership-123';
const SLOT_ID = 'slot-123';

const slotRow = {
  id: SLOT_ID,
  classId: CLASS_ID,
  subjectId: SUBJECT_ID,
  membershipId: MEMBERSHIP_ID,
  dayOfWeek: DayOfWeek.MONDAY,
  startMinutes: 540,
  endMinutes: 600,
  room: 'Room 12',
  createdAt: new Date('2026-01-05T10:00:00.000Z'),
  updatedAt: new Date('2026-01-05T10:00:00.000Z'),
  subject: { id: SUBJECT_ID, name: 'Mathematics', code: 'MATH' },
  membership: {
    id: MEMBERSHIP_ID,
    user: { id: 'user-teacher', firstName: 'Nimal', lastName: 'Perera' },
  },
};

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const createBody = {
  subjectId: SUBJECT_ID,
  membershipId: MEMBERSHIP_ID,
  dayOfWeek: DayOfWeek.MONDAY,
  startMinutes: 540,
  endMinutes: 600,
  room: 'Room 12',
};

function exclusionViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    'Database error. Code: `23P01`. Message: conflicting key value violates exclusion constraint "class_schedule_slots_no_class_overlap"',
    {
      code: 'P2039',
      clientVersion: '7.10.1',
      meta: {
        modelName: 'ClassScheduleSlot',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23P01',
            originalMessage:
              'conflicting key value violates exclusion constraint "class_schedule_slots_no_class_overlap"',
          },
        },
      },
    },
  );
}

describe('ClassScheduleService', () => {
  const tx = {
    class: { findFirst: vi.fn() },
    classSubject: { findFirst: vi.fn() },
    membership: { findFirst: vi.fn() },
    classScheduleSlot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

  let service: ClassScheduleService;

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

    service = new ClassScheduleService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  function activeClass() {
    tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
  }

  function linkedActiveSubject() {
    tx.classSubject.findFirst.mockResolvedValue({ subject: { status: 'ACTIVE' } });
  }

  function eligibleTeacher() {
    tx.membership.findFirst.mockResolvedValue({ id: MEMBERSHIP_ID });
  }

  describe('listForClass', () => {
    it('returns the timetable ordered by day and start time', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.classScheduleSlot.findMany.mockResolvedValue([slotRow]);

      const result = await service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID);

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        READ_ROLES,
        tx,
      );
      expect(tx.classScheduleSlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID },
          orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }],
        }),
      );
      expect(result).toEqual({ items: [slotRow] });
    });

    it('returns 404 for a class outside the workspace', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.classScheduleSlot.findMany).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a slot with a teacher and records an audit event', async () => {
      activeClass();
      linkedActiveSubject();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst.mockResolvedValue(null);
      tx.classScheduleSlot.create.mockResolvedValue(slotRow);

      const result = await service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody);

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        MANAGE_ROLES,
        tx,
      );
      expect(tx.classSubject.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID, subjectId: SUBJECT_ID },
        }),
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
      expect(tx.classScheduleSlot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: WORKSPACE_ID,
            classId: CLASS_ID,
            dayOfWeek: DayOfWeek.MONDAY,
            startMinutes: { lt: 600 },
            endMinutes: { gt: 540 },
          },
        }),
      );
      expect(tx.classScheduleSlot.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          subjectId: SUBJECT_ID,
          membershipId: MEMBERSHIP_ID,
          dayOfWeek: DayOfWeek.MONDAY,
          startMinutes: 540,
          endMinutes: 600,
          room: 'Room 12',
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_SCHEDULE_SLOT_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: SLOT_ID,
        metadata: {
          classId: CLASS_ID,
          subjectId: SUBJECT_ID,
          membershipId: MEMBERSHIP_ID,
          dayOfWeek: DayOfWeek.MONDAY,
          startMinutes: 540,
          endMinutes: 600,
        },
      });
      expect(result).toEqual(slotRow);
    });

    it('creates a slot without a teacher', async () => {
      activeClass();
      linkedActiveSubject();
      tx.classScheduleSlot.findFirst.mockResolvedValue(null);
      tx.classScheduleSlot.create.mockResolvedValue({
        ...slotRow,
        membershipId: null,
        membership: null,
      });

      await service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        ...createBody,
        membershipId: null,
        room: '',
      });

      expect(tx.membership.findFirst).not.toHaveBeenCalled();
      expect(tx.classScheduleSlot.findFirst).toHaveBeenCalledTimes(1);
      expect(tx.classScheduleSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ membershipId: null, room: null }),
        }),
      );
    });

    it('allows back-to-back slots by using half-open overlap checks', async () => {
      activeClass();
      linkedActiveSubject();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst.mockResolvedValue(null);
      tx.classScheduleSlot.create.mockResolvedValue(slotRow);

      await service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        ...createBody,
        startMinutes: 600,
        endMinutes: 660,
      });

      expect(tx.classScheduleSlot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startMinutes: { lt: 660 },
            endMinutes: { gt: 600 },
          }),
        }),
      );
    });

    it('rejects archived classes', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ARCHIVED });

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.classScheduleSlot.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid time range before touching related records', async () => {
      activeClass();

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
          ...createBody,
          startMinutes: 600,
          endMinutes: 600,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(tx.classSubject.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a subject that is not linked to the class', async () => {
      activeClass();
      tx.classSubject.findFirst.mockResolvedValue(null);

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an archived subject', async () => {
      activeClass();
      tx.classSubject.findFirst.mockResolvedValue({ subject: { status: 'ARCHIVED' } });

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a teacher outside the directory', async () => {
      activeClass();
      linkedActiveSubject();
      tx.membership.findFirst.mockResolvedValue(null);

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a slot overlapping another slot for the same class', async () => {
      activeClass();
      linkedActiveSubject();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst.mockResolvedValueOnce({ id: 'other-slot' });

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.classScheduleSlot.create).not.toHaveBeenCalled();
    });

    it('rejects a teacher booked in another class at the same time', async () => {
      activeClass();
      linkedActiveSubject();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'other-slot' });

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.classScheduleSlot.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ membershipId: MEMBERSHIP_ID }),
        }),
      );
      expect(tx.classScheduleSlot.create).not.toHaveBeenCalled();
    });

    it('maps a database exclusion violation to a conflict', async () => {
      activeClass();
      linkedActiveSubject();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst.mockResolvedValue(null);
      tx.classScheduleSlot.create.mockRejectedValue(exclusionViolation());

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, createBody)).rejects.toThrow(
        ConflictException,
      );
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates changed fields and records which changed', async () => {
      activeClass();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst.mockResolvedValueOnce(slotRow).mockResolvedValue(null);
      tx.classScheduleSlot.update.mockResolvedValue({
        ...slotRow,
        startMinutes: 600,
        endMinutes: 660,
      });

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, {
        startMinutes: 600,
        endMinutes: 660,
        room: 'Lab 2',
      });

      expect(tx.classScheduleSlot.update).toHaveBeenCalledWith({
        where: { id: SLOT_ID },
        data: expect.objectContaining({
          startMinutes: 600,
          endMinutes: 660,
          room: 'Lab 2',
        }),
        select: expect.any(Object),
      });
      expect(tx.classScheduleSlot.findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: SLOT_ID } }),
        }),
      );
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AuditEventType.CLASS_SCHEDULE_SLOT_UPDATED,
          targetId: SLOT_ID,
          metadata: expect.objectContaining({
            fields: expect.arrayContaining(['startMinutes', 'endMinutes', 'room']),
          }),
        }),
      );
      expect(result.startMinutes).toBe(600);
    });

    it('skips the write and audit when nothing changes', async () => {
      activeClass();
      eligibleTeacher();
      tx.classScheduleSlot.findFirst.mockResolvedValueOnce(slotRow).mockResolvedValue(null);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, {});

      expect(tx.classScheduleSlot.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result).toEqual(slotRow);
    });

    it('clears the teacher when membershipId is null', async () => {
      activeClass();
      tx.classScheduleSlot.findFirst.mockResolvedValueOnce(slotRow).mockResolvedValue(null);
      tx.classScheduleSlot.update.mockResolvedValue({
        ...slotRow,
        membershipId: null,
        membership: null,
      });

      await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, { membershipId: null });

      expect(tx.membership.findFirst).not.toHaveBeenCalled();
      expect(tx.classScheduleSlot.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ membershipId: null }) }),
      );
    });

    it('re-validates a changed subject', async () => {
      activeClass();
      tx.classScheduleSlot.findFirst.mockResolvedValue(slotRow);
      tx.classSubject.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, {
          subjectId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a range that ends before it starts', async () => {
      activeClass();
      tx.classScheduleSlot.findFirst.mockResolvedValue(slotRow);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, { endMinutes: 500 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects archived classes', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ARCHIVED });

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, { room: 'Lab 2' }),
      ).rejects.toThrow(ConflictException);
    });

    it('returns 404 for an unknown slot', async () => {
      activeClass();
      tx.classScheduleSlot.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID, { room: 'Lab 2' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the slot and records an audit event', async () => {
      activeClass();
      tx.classScheduleSlot.findFirst.mockResolvedValue({ id: SLOT_ID });
      tx.classScheduleSlot.delete.mockResolvedValue(slotRow);

      const result = await service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID);

      expect(tx.classScheduleSlot.delete).toHaveBeenCalledWith({
        where: { id: SLOT_ID },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AuditEventType.CLASS_SCHEDULE_SLOT_DELETED,
          targetId: SLOT_ID,
          metadata: expect.objectContaining({ classId: CLASS_ID, subjectId: SUBJECT_ID }),
        }),
      );
      expect(result).toEqual(slotRow);
    });

    it('returns 404 for an unknown slot', async () => {
      activeClass();
      tx.classScheduleSlot.findFirst.mockResolvedValue(null);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.classScheduleSlot.delete).not.toHaveBeenCalled();
    });

    it('rejects archived classes', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ARCHIVED });

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID, SLOT_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
