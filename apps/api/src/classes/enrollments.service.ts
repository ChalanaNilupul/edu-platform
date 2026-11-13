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
  EnrollmentStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import type { ListEnrollmentsQueryDto } from './dto/list-enrollments.query.js';
import type { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const enrollmentSelect = {
  id: true,
  studentId: true,
  classId: true,
  status: true,
  enrolledAt: true,
  endedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: { id: true, studentCode: true, firstName: true, lastName: true },
  },
  class: {
    select: { id: true, name: true, grade: true, status: true, capacity: true },
  },
} satisfies Prisma.EnrollmentSelect;

type EnrollmentRow = Prisma.EnrollmentGetPayload<{ select: typeof enrollmentSelect }>;

export type EnrollmentView = EnrollmentRow;

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null || value.length === 0 ? null : value;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function comparable(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function duplicateEnrollmentError(): ConflictException {
  return new ConflictException('Student is already enrolled in this class');
}

function archivedClassError(): ConflictException {
  return new ConflictException('Archived classes cannot accept enrollments');
}

function classFullError(): ConflictException {
  return new ConflictException('Class has reached its enrollment capacity');
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listForClass(
    actorId: string,
    workspaceId: string,
    classId: string,
    query: ListEnrollmentsQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const search = query.search?.trim();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const schoolClass = await tx.class.findFirst({
        where: { id: classId, workspaceId },
        select: { id: true },
      });

      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }

      const where: Prisma.EnrollmentWhereInput = { workspaceId, classId };

      if (query.status) {
        where.status = query.status;
      }

      if (search) {
        where.student = {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { studentCode: { contains: search, mode: 'insensitive' } },
          ],
        };
      }

      const [items, total] = await Promise.all([
        tx.enrollment.findMany({
          where,
          select: enrollmentSelect,
          orderBy: [{ status: 'asc' }, { student: { firstName: 'asc' } }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.enrollment.count({ where }),
      ]);

      return {
        items,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async listForStudent(actorId: string, workspaceId: string, studentId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const student = await tx.student.findFirst({
        where: { id: studentId, workspaceId },
        select: { id: true },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      return tx.enrollment.findMany({
        where: { workspaceId, studentId },
        select: enrollmentSelect,
        orderBy: [{ enrolledAt: 'desc' }, { createdAt: 'desc' }],
      });
    });
  }

  async enroll(actorId: string, workspaceId: string, classId: string, dto: CreateEnrollmentDto) {
    let enrollment: EnrollmentView;

    try {
      enrollment = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const schoolClass = await tx.class.findFirst({
          where: { id: classId, workspaceId },
          select: { id: true, status: true, capacity: true },
        });

        if (!schoolClass) {
          throw new NotFoundException('Class not found');
        }

        if (schoolClass.status !== ClassStatus.ACTIVE) {
          throw archivedClassError();
        }

        const student = await tx.student.findFirst({
          where: { id: dto.studentId, workspaceId },
          select: { id: true },
        });

        if (!student) {
          throw new NotFoundException('Student not found');
        }

        if (schoolClass.capacity !== null) {
          const activeEnrollments = await tx.enrollment.count({
            where: { workspaceId, classId, status: EnrollmentStatus.ACTIVE },
          });

          if (activeEnrollments >= schoolClass.capacity) {
            throw classFullError();
          }
        }

        return tx.enrollment.create({
          data: {
            workspaceId,
            classId,
            studentId: dto.studentId,
            enrolledAt: dto.enrolledAt ? new Date(dto.enrolledAt) : undefined,
            notes: nullableText(dto.notes) ?? null,
          },
          select: enrollmentSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateEnrollmentError();
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.STUDENT_ENROLLED,
      actorUserId: actorId,
      workspaceId,
      targetId: enrollment.id,
      metadata: { classId, studentId: dto.studentId },
    });

    return enrollment;
  }

  async update(
    actorId: string,
    workspaceId: string,
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
  ) {
    if (dto.status === undefined && dto.endedAt === undefined && dto.notes === undefined) {
      throw new BadRequestException('Provide at least one field to update');
    }

    let result: {
      updated: EnrollmentView;
      fields: string[];
      from?: EnrollmentStatus;
      to?: EnrollmentStatus;
    };

    try {
      result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const existing = await tx.enrollment.findFirst({
          where: { id: enrollmentId, workspaceId },
          select: enrollmentSelect,
        });

        if (!existing) {
          throw new NotFoundException('Enrollment not found');
        }

        const data: Prisma.EnrollmentUncheckedUpdateInput = {};
        const reactivating =
          dto.status === EnrollmentStatus.ACTIVE && existing.status !== EnrollmentStatus.ACTIVE;

        if (dto.status !== undefined) {
          data.status = dto.status;
        }

        if (dto.notes !== undefined) {
          data.notes = nullableText(dto.notes) ?? null;
        }

        if (reactivating) {
          if (existing.class.status !== ClassStatus.ACTIVE) {
            throw archivedClassError();
          }

          if (existing.class.capacity !== null) {
            const activeCount = await tx.enrollment.count({
              where: {
                workspaceId,
                classId: existing.classId,
                status: EnrollmentStatus.ACTIVE,
                id: { not: existing.id },
              },
            });

            if (activeCount >= existing.class.capacity) {
              throw classFullError();
            }
          }

          data.endedAt = null;
        } else if (dto.endedAt !== undefined) {
          data.endedAt = new Date(dto.endedAt);
        } else if (
          dto.status !== undefined &&
          dto.status !== EnrollmentStatus.ACTIVE &&
          existing.status === EnrollmentStatus.ACTIVE
        ) {
          data.endedAt = new Date();
        }

        const fields = Object.entries(data)
          .filter(
            ([field, value]) =>
              comparable(existing[field as keyof EnrollmentRow]) !== comparable(value),
          )
          .map(([field]) => field);

        if (fields.length === 0) {
          return { updated: existing, fields };
        }

        const updated = await tx.enrollment.update({
          where: { id: existing.id },
          data,
          select: enrollmentSelect,
        });

        return {
          updated,
          fields,
          from: existing.status !== updated.status ? existing.status : undefined,
          to: existing.status !== updated.status ? updated.status : undefined,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateEnrollmentError();
      }

      throw error;
    }

    if (result.fields.length > 0) {
      await this.audit.record({
        type: AuditEventType.ENROLLMENT_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: enrollmentId,
        metadata: {
          classId: result.updated.classId,
          studentId: result.updated.studentId,
          fields: result.fields,
          ...(result.from && result.to ? { from: result.from, to: result.to } : {}),
        },
      });
    }

    return result.updated;
  }
}
