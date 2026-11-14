import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  MembershipStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { AssignClassTeacherDto } from './dto/assign-class-teacher.dto.js';
import type { ListClassTeachersQueryDto } from './dto/list-class-teachers.query.js';
import type { UpdateClassTeacherDto } from './dto/update-class-teacher.dto.js';

const READ_ROLES: WorkspaceRole[] = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.BRANCH_MANAGER,
  WorkspaceRole.TEACHER,
];
const MANAGE_ROLES: WorkspaceRole[] = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const assignmentSelect = {
  id: true,
  classId: true,
  membershipId: true,
  isPrimary: true,
  assignedAt: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
  class: {
    select: { id: true, name: true, grade: true, status: true },
  },
  membership: {
    select: {
      id: true,
      role: true,
      status: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      teacherProfile: {
        select: { specializations: true },
      },
    },
  },
} satisfies Prisma.ClassTeacherSelect;

export type ClassTeacherView = Prisma.ClassTeacherGetPayload<{ select: typeof assignmentSelect }>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function directoryEligibility(): Prisma.MembershipWhereInput {
  return {
    OR: [{ role: WorkspaceRole.TEACHER }, { teacherProfile: { isNot: null } }],
  };
}

function duplicateAssignmentError(): ConflictException {
  return new ConflictException('Teacher is already assigned to this class');
}

@Injectable()
export class ClassTeachersService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listForClass(
    actorId: string,
    workspaceId: string,
    classId: string,
    query: ListClassTeachersQueryDto,
  ) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      const actor = await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const schoolClass = await tx.class.findFirst({
        where: { id: classId, workspaceId },
        select: { id: true },
      });

      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }

      const isManager = actor.role === WorkspaceRole.OWNER || MANAGE_ROLES.includes(actor.role);

      const [items, past] = await Promise.all([
        tx.classTeacher.findMany({
          where: { workspaceId, classId, endedAt: null },
          select: assignmentSelect,
          orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
        }),
        query.includeEnded && isManager
          ? tx.classTeacher.findMany({
              where: { workspaceId, classId, endedAt: { not: null } },
              select: assignmentSelect,
              orderBy: [{ endedAt: 'desc' }, { assignedAt: 'desc' }],
            })
          : Promise.resolve([]),
      ]);

      return { items, past };
    });
  }

  async listForTeacher(actorId: string, workspaceId: string, membershipId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      const actor = await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const teacher = await tx.membership.findFirst({
        where: { id: membershipId, workspaceId, AND: [directoryEligibility()] },
        select: { id: true },
      });

      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      const isManager = actor.role === WorkspaceRole.OWNER || MANAGE_ROLES.includes(actor.role);

      const [items, past] = await Promise.all([
        tx.classTeacher.findMany({
          where: { workspaceId, membershipId, endedAt: null },
          select: assignmentSelect,
          orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
        }),
        isManager
          ? tx.classTeacher.findMany({
              where: { workspaceId, membershipId, endedAt: { not: null } },
              select: assignmentSelect,
              orderBy: [{ endedAt: 'desc' }, { assignedAt: 'desc' }],
            })
          : Promise.resolve([]),
      ]);

      return { items, past };
    });
  }

  async assign(actorId: string, workspaceId: string, classId: string, dto: AssignClassTeacherDto) {
    let assignment: ClassTeacherView;

    try {
      assignment = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const schoolClass = await tx.class.findFirst({
          where: { id: classId, workspaceId },
          select: { id: true, status: true },
        });

        if (!schoolClass) {
          throw new NotFoundException('Class not found');
        }

        if (schoolClass.status !== ClassStatus.ACTIVE) {
          throw new ConflictException('Archived classes cannot accept teacher assignments');
        }

        const teacher = await tx.membership.findFirst({
          where: {
            id: dto.membershipId,
            workspaceId,
            status: MembershipStatus.ACTIVE,
            AND: [directoryEligibility()],
          },
          select: { id: true },
        });

        if (!teacher) {
          throw new NotFoundException('Teacher not found');
        }

        const current = await tx.classTeacher.findFirst({
          where: { workspaceId, classId, membershipId: dto.membershipId, endedAt: null },
          select: { id: true },
        });

        if (current) {
          throw duplicateAssignmentError();
        }

        const isPrimary = dto.isPrimary === true;

        if (isPrimary) {
          await tx.classTeacher.updateMany({
            where: { workspaceId, classId, endedAt: null, isPrimary: true },
            data: { isPrimary: false },
          });
        }

        return tx.classTeacher.create({
          data: {
            workspaceId,
            classId,
            membershipId: dto.membershipId,
            isPrimary,
          },
          select: assignmentSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateAssignmentError();
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.CLASS_TEACHER_ASSIGNED,
      actorUserId: actorId,
      workspaceId,
      targetId: assignment.id,
      metadata: {
        classId,
        membershipId: dto.membershipId,
        isPrimary: assignment.isPrimary,
      },
    });

    return assignment;
  }

  async update(
    actorId: string,
    workspaceId: string,
    classId: string,
    assignmentId: string,
    dto: UpdateClassTeacherDto,
  ) {
    let result: { updated: ClassTeacherView; changed: boolean };

    try {
      result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const existing = await tx.classTeacher.findFirst({
          where: { id: assignmentId, classId, workspaceId },
          select: assignmentSelect,
        });

        if (!existing) {
          throw new NotFoundException('Teacher assignment not found');
        }

        if (existing.endedAt !== null) {
          throw new ConflictException('Ended teacher assignments cannot be changed');
        }

        if (existing.isPrimary === dto.isPrimary) {
          return { updated: existing, changed: false };
        }

        if (dto.isPrimary) {
          await tx.classTeacher.updateMany({
            where: {
              workspaceId,
              classId,
              endedAt: null,
              isPrimary: true,
              id: { not: existing.id },
            },
            data: { isPrimary: false },
          });
        }

        const updated = await tx.classTeacher.update({
          where: { id: existing.id },
          data: { isPrimary: dto.isPrimary },
          select: assignmentSelect,
        });

        return { updated, changed: true };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Another teacher is already marked as the primary teacher for this class',
        );
      }

      throw error;
    }

    if (result.changed) {
      await this.audit.record({
        type: AuditEventType.CLASS_TEACHER_PRIMARY_CHANGED,
        actorUserId: actorId,
        workspaceId,
        targetId: assignmentId,
        metadata: {
          classId,
          membershipId: result.updated.membershipId,
          isPrimary: result.updated.isPrimary,
        },
      });
    }

    return result.updated;
  }

  async remove(actorId: string, workspaceId: string, classId: string, assignmentId: string) {
    const updated = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const existing = await tx.classTeacher.findFirst({
        where: { id: assignmentId, classId, workspaceId },
        select: assignmentSelect,
      });

      if (!existing) {
        throw new NotFoundException('Teacher assignment not found');
      }

      if (existing.endedAt !== null) {
        throw new ConflictException('This teacher assignment has already ended');
      }

      return tx.classTeacher.update({
        where: { id: existing.id },
        data: { endedAt: new Date() },
        select: assignmentSelect,
      });
    });

    await this.audit.record({
      type: AuditEventType.CLASS_TEACHER_REMOVED,
      actorUserId: actorId,
      workspaceId,
      targetId: assignmentId,
      metadata: {
        classId,
        membershipId: updated.membershipId,
        endedAt: updated.endedAt?.toISOString() ?? null,
      },
    });

    return updated;
  }
}
