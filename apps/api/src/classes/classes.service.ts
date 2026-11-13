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
  EnrollmentStatus,
  Prisma,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateClassDto } from './dto/create-class.dto.js';
import type { ListClassesQueryDto } from './dto/list-classes.query.js';
import type { UpdateClassDto } from './dto/update-class.dto.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const classSelect = {
  id: true,
  name: true,
  grade: true,
  description: true,
  capacity: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
    },
  },
} satisfies Prisma.ClassSelect;

type ClassRow = Prisma.ClassGetPayload<{ select: typeof classSelect }>;

export type ClassView = Omit<ClassRow, '_count'> & { enrolledCount: number };

function toView(row: ClassRow): ClassView {
  const { _count, ...rest } = row;

  return { ...rest, enrolledCount: _count.enrollments };
}

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

function changedFields(
  existing: ClassRow,
  data: Prisma.ClassUncheckedUpdateInput,
): Prisma.ClassUncheckedUpdateInput {
  const changed: Prisma.ClassUncheckedUpdateInput = {};

  for (const [field, value] of Object.entries(data)) {
    if (comparable(existing[field as keyof ClassRow]) !== comparable(value)) {
      (changed as Record<string, unknown>)[field] = value;
    }
  }

  return changed;
}

function duplicateNameError(): ConflictException {
  return new ConflictException('A class with this name already exists');
}

@Injectable()
export class ClassesService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, query: ListClassesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const search = query.search?.trim();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const where: Prisma.ClassWhereInput = { workspaceId };

      if (query.status) {
        where.status = query.status;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { grade: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        tx.class.findMany({
          where,
          select: classSelect,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.class.count({ where }),
      ]);

      return {
        items: rows.map(toView),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async findOne(actorId: string, workspaceId: string, classId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const row = await tx.class.findFirst({
        where: { id: classId, workspaceId },
        select: classSelect,
      });

      if (!row) {
        throw new NotFoundException('Class not found');
      }

      return toView(row);
    });
  }

  async create(actorId: string, workspaceId: string, dto: CreateClassDto) {
    let created: ClassView;

    try {
      created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const row = await tx.class.create({
          data: {
            workspaceId,
            name: dto.name,
            grade: nullableText(dto.grade) ?? null,
            description: nullableText(dto.description) ?? null,
            capacity: dto.capacity ?? null,
          },
          select: classSelect,
        });

        return toView(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateNameError();
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.CLASS_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: { status: created.status },
    });

    return created;
  }

  async update(actorId: string, workspaceId: string, classId: string, dto: UpdateClassDto) {
    const data = this.buildUpdateData(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    let result: { updated: ClassView; changed: string[] };

    try {
      result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const existing = await tx.class.findFirst({
          where: { id: classId, workspaceId },
          select: classSelect,
        });

        if (!existing) {
          throw new NotFoundException('Class not found');
        }

        const changed = changedFields(existing, data);

        if (Object.keys(changed).length === 0) {
          return { updated: toView(existing), changed: [] };
        }

        const row = await tx.class.update({
          where: { id: existing.id },
          data: changed,
          select: classSelect,
        });

        return { updated: toView(row), changed: Object.keys(changed) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw duplicateNameError();
      }

      throw error;
    }

    if (result.changed.length > 0) {
      await this.audit.record({
        type: AuditEventType.CLASS_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: classId,
        metadata: { fields: result.changed },
      });
    }

    return result.updated;
  }

  async remove(actorId: string, workspaceId: string, classId: string) {
    await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const existing = await tx.class.findFirst({
        where: { id: classId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Class not found');
      }

      const enrollments = await tx.enrollment.count({ where: { workspaceId, classId } });

      if (enrollments > 0) {
        throw new ConflictException(
          'Archive this class instead of deleting it while enrollment records exist',
        );
      }

      await tx.class.delete({ where: { id: existing.id } });
    });

    await this.audit.record({
      type: AuditEventType.CLASS_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: classId,
    });
  }

  private buildUpdateData(dto: UpdateClassDto): Prisma.ClassUncheckedUpdateInput {
    const data: Prisma.ClassUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.grade !== undefined) {
      data.grade = nullableText(dto.grade) ?? null;
    }

    if (dto.description !== undefined) {
      data.description = nullableText(dto.description) ?? null;
    }

    if (dto.capacity !== undefined) {
      data.capacity = dto.capacity ?? null;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return data;
  }
}
