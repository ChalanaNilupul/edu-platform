import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { AuditEventType, Prisma, WorkspaceRole } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateStudentDto } from './dto/create-student.dto.js';
import type { ListStudentsQueryDto } from './dto/list-students.query.js';
import type { UpdateStudentDto } from './dto/update-student.dto.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const studentSelect = {
  id: true,
  studentCode: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  email: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  district: true,
  postalCode: true,
  school: true,
  grade: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentSelect;

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null || value.length === 0 ? null : value;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type StudentRow = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

function comparable(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

// Clients send the whole profile on save, so only the fields that actually
// differ should reach the database and the audit log.
function changedFields(
  existing: StudentRow,
  data: Prisma.StudentUncheckedUpdateInput,
): Prisma.StudentUncheckedUpdateInput {
  const changed: Prisma.StudentUncheckedUpdateInput = {};

  for (const [field, value] of Object.entries(data)) {
    if (comparable(existing[field as keyof StudentRow]) !== comparable(value)) {
      (changed as Record<string, unknown>)[field] = value;
    }
  }

  return changed;
}

function duplicateCodeError(): ConflictException {
  return new ConflictException('A student with this student code already exists');
}

@Injectable()
export class StudentsService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, query: ListStudentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const search = query.search?.trim();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const where: Prisma.StudentWhereInput = { workspaceId };

      if (query.status) {
        where.status = query.status;
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { studentCode: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ];
      }

      const [items, total] = await Promise.all([
        tx.student.findMany({
          where,
          select: studentSelect,
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.student.count({ where }),
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

  async findOne(actorId: string, workspaceId: string, studentId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const student = await tx.student.findFirst({
        where: { id: studentId, workspaceId },
        select: studentSelect,
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      return student;
    });
  }

  async create(actorId: string, workspaceId: string, dto: CreateStudentDto) {
    let student: Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

    try {
      student = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        return tx.student.create({
          data: {
            workspaceId,
            firstName: dto.firstName,
            lastName: nullableText(dto.lastName) ?? null,
            studentCode: nullableText(dto.studentCode) ?? null,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            gender: dto.gender ?? null,
            email: nullableText(dto.email) ?? null,
            phone: nullableText(dto.phone) ?? null,
            addressLine1: nullableText(dto.addressLine1) ?? null,
            addressLine2: nullableText(dto.addressLine2) ?? null,
            city: nullableText(dto.city) ?? null,
            district: nullableText(dto.district) ?? null,
            postalCode: nullableText(dto.postalCode) ?? null,
            school: nullableText(dto.school) ?? null,
            grade: nullableText(dto.grade) ?? null,
          },
          select: studentSelect,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateCodeError();
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.STUDENT_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: student.id,
    });

    return student;
  }

  async update(actorId: string, workspaceId: string, studentId: string, dto: UpdateStudentDto) {
    const data = this.buildUpdateData(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    let result: {
      updated: StudentRow;
      previousStatus: string;
      changed: Prisma.StudentUncheckedUpdateInput;
    };

    try {
      result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const existing = await tx.student.findFirst({
          where: { id: studentId, workspaceId },
          select: studentSelect,
        });

        if (!existing) {
          throw new NotFoundException('Student not found');
        }

        const changed = changedFields(existing, data);

        if (Object.keys(changed).length === 0) {
          return { updated: existing, previousStatus: existing.status, changed };
        }

        const updated = await tx.student.update({
          where: { id: existing.id },
          data: changed,
          select: studentSelect,
        });

        return { updated, previousStatus: existing.status, changed };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateCodeError();
      }

      throw error;
    }

    const statusChanged = result.previousStatus !== result.updated.status;
    const otherFields = Object.keys(result.changed).filter((field) => field !== 'status');

    if (statusChanged) {
      await this.audit.record({
        type: AuditEventType.STUDENT_STATUS_CHANGED,
        actorUserId: actorId,
        workspaceId,
        targetId: studentId,
        metadata: { from: result.previousStatus, to: result.updated.status },
      });
    }

    if (otherFields.length > 0) {
      await this.audit.record({
        type: AuditEventType.STUDENT_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: studentId,
        metadata: { fields: otherFields },
      });
    }

    return result.updated;
  }

  private buildUpdateData(dto: UpdateStudentDto): Prisma.StudentUncheckedUpdateInput {
    const data: Prisma.StudentUncheckedUpdateInput = {};

    if (dto.studentCode !== undefined) {
      data.studentCode = nullableText(dto.studentCode) ?? null;
    }

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName;
    }

    if (dto.lastName !== undefined) {
      data.lastName = nullableText(dto.lastName) ?? null;
    }

    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    }

    if (dto.gender !== undefined) {
      data.gender = dto.gender ?? null;
    }

    if (dto.email !== undefined) {
      data.email = nullableText(dto.email) ?? null;
    }

    if (dto.phone !== undefined) {
      data.phone = nullableText(dto.phone) ?? null;
    }

    if (dto.addressLine1 !== undefined) {
      data.addressLine1 = nullableText(dto.addressLine1) ?? null;
    }

    if (dto.addressLine2 !== undefined) {
      data.addressLine2 = nullableText(dto.addressLine2) ?? null;
    }

    if (dto.city !== undefined) {
      data.city = nullableText(dto.city) ?? null;
    }

    if (dto.district !== undefined) {
      data.district = nullableText(dto.district) ?? null;
    }

    if (dto.postalCode !== undefined) {
      data.postalCode = nullableText(dto.postalCode) ?? null;
    }

    if (dto.school !== undefined) {
      data.school = nullableText(dto.school) ?? null;
    }

    if (dto.grade !== undefined) {
      data.grade = nullableText(dto.grade) ?? null;
    }

    if (dto.status !== undefined && dto.status !== null) {
      data.status = dto.status;
    }

    return data;
  }
}
