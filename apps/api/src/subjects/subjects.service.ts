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
  Prisma,
  SubjectStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateSubjectDto } from './dto/create-subject.dto.js';
import type { ListSubjectsQueryDto } from './dto/list-subjects.query.js';
import type { UpdateSubjectDto } from './dto/update-subject.dto.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { classLinks: true },
  },
} satisfies Prisma.SubjectSelect;

type SubjectRow = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>;

export type SubjectView = Omit<SubjectRow, '_count'> & { classCount: number };

function toView(row: SubjectRow): SubjectView {
  const { _count, ...rest } = row;

  return { ...rest, classCount: _count.classLinks };
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
  existing: SubjectRow,
  data: Prisma.SubjectUncheckedUpdateInput,
): Prisma.SubjectUncheckedUpdateInput {
  const changed: Prisma.SubjectUncheckedUpdateInput = {};

  for (const [field, value] of Object.entries(data)) {
    if (comparable(existing[field as keyof SubjectRow]) !== comparable(value)) {
      (changed as Record<string, unknown>)[field] = value;
    }
  }

  return changed;
}

@Injectable()
export class SubjectsService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, query: ListSubjectsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);
    const search = query.search?.trim();

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const where: Prisma.SubjectWhereInput = { workspaceId };

      if (query.status) {
        where.status = query.status;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [rows, total] = await Promise.all([
        tx.subject.findMany({
          where,
          select: subjectSelect,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.subject.count({ where }),
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

  async findOne(actorId: string, workspaceId: string, subjectId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const row = await tx.subject.findFirst({
        where: { id: subjectId, workspaceId },
        select: subjectSelect,
      });

      if (!row) {
        throw new NotFoundException('Subject not found');
      }

      return toView(row);
    });
  }

  async create(actorId: string, workspaceId: string, dto: CreateSubjectDto) {
    const code = nullableText(dto.code) ?? null;

    let created: SubjectView;

    try {
      created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const duplicateName = await tx.subject.findFirst({
          where: { workspaceId, name: dto.name },
          select: { id: true },
        });

        if (duplicateName) {
          throw new ConflictException('A subject with this name already exists');
        }

        if (code) {
          const duplicateCode = await tx.subject.findFirst({
            where: { workspaceId, code },
            select: { id: true },
          });

          if (duplicateCode) {
            throw new ConflictException('A subject with this code already exists');
          }
        }

        const row = await tx.subject.create({
          data: {
            workspaceId,
            name: dto.name,
            code,
            description: nullableText(dto.description) ?? null,
          },
          select: subjectSelect,
        });

        return toView(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A subject with this name or code already exists');
      }

      throw error;
    }

    await this.audit.record({
      type: AuditEventType.SUBJECT_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: { status: created.status },
    });

    return created;
  }

  async update(actorId: string, workspaceId: string, subjectId: string, dto: UpdateSubjectDto) {
    const data = this.buildUpdateData(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    let result: { updated: SubjectView; changed: string[] };

    try {
      result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
        await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

        const existing = await tx.subject.findFirst({
          where: { id: subjectId, workspaceId },
          select: subjectSelect,
        });

        if (!existing) {
          throw new NotFoundException('Subject not found');
        }

        const changed = changedFields(existing, data);

        if (Object.keys(changed).length === 0) {
          return { updated: toView(existing), changed: [] };
        }

        if (changed.name !== undefined) {
          const duplicateName = await tx.subject.findFirst({
            where: { workspaceId, name: changed.name as string, id: { not: existing.id } },
            select: { id: true },
          });

          if (duplicateName) {
            throw new ConflictException('A subject with this name already exists');
          }
        }

        if (typeof changed.code === 'string') {
          const duplicateCode = await tx.subject.findFirst({
            where: { workspaceId, code: changed.code, id: { not: existing.id } },
            select: { id: true },
          });

          if (duplicateCode) {
            throw new ConflictException('A subject with this code already exists');
          }
        }

        const row = await tx.subject.update({
          where: { id: existing.id },
          data: changed,
          select: subjectSelect,
        });

        return { updated: toView(row), changed: Object.keys(changed) };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A subject with this name or code already exists');
      }

      throw error;
    }

    if (result.changed.length > 0) {
      const archived = result.updated.status === SubjectStatus.ARCHIVED;

      await this.audit.record({
        type: archived ? AuditEventType.SUBJECT_ARCHIVED : AuditEventType.SUBJECT_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: subjectId,
        metadata: { fields: result.changed },
      });
    }

    return result.updated;
  }

  async remove(actorId: string, workspaceId: string, subjectId: string) {
    await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const existing = await tx.subject.findFirst({
        where: { id: subjectId, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Subject not found');
      }

      const classLinks = await tx.classSubject.count({ where: { workspaceId, subjectId } });

      if (classLinks > 0) {
        throw new ConflictException(
          'Archive this subject instead of deleting it while classes are linked',
        );
      }

      await tx.subject.delete({ where: { id: existing.id } });
    });

    await this.audit.record({
      type: AuditEventType.SUBJECT_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: subjectId,
    });
  }

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

      const rows = await tx.subject.findMany({
        where: { workspaceId, classLinks: { some: { workspaceId, classId } } },
        select: subjectSelect,
        orderBy: [{ name: 'asc' }],
      });

      return { items: rows.map(toView) };
    });
  }

  async replaceForClass(
    actorId: string,
    workspaceId: string,
    classId: string,
    subjectIds: string[],
  ) {
    const uniqueIds = [...new Set(subjectIds)];

    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const schoolClass = await tx.class.findFirst({
        where: { id: classId, workspaceId },
        select: { id: true, status: true },
      });

      if (!schoolClass) {
        throw new NotFoundException('Class not found');
      }

      if (schoolClass.status !== ClassStatus.ACTIVE) {
        throw new ConflictException('Archived classes cannot change their subjects');
      }

      const existing = await tx.classSubject.findMany({
        where: { workspaceId, classId },
        select: { id: true, subjectId: true },
      });

      const existingIds = new Set(existing.map((row) => row.subjectId));
      const requestedIds = new Set(uniqueIds);
      const added = uniqueIds.filter((id) => !existingIds.has(id));
      const removedRows = existing.filter((row) => !requestedIds.has(row.subjectId));

      if (uniqueIds.length > 0) {
        const found = await tx.subject.findMany({
          where: { workspaceId, id: { in: uniqueIds } },
          select: { id: true, status: true },
        });

        if (found.length !== uniqueIds.length) {
          throw new NotFoundException('Subject not found');
        }

        // Existing links may survive an archive; only new links must be active.
        const archivedNewLink = found.some(
          (row) => row.status !== SubjectStatus.ACTIVE && added.includes(row.id),
        );

        if (archivedNewLink) {
          throw new ConflictException('Archived subjects cannot be assigned to a class');
        }
      }

      if (added.length > 0) {
        await tx.classSubject.createMany({
          data: added.map((subjectId) => ({ workspaceId, classId, subjectId })),
        });
      }

      if (removedRows.length > 0) {
        await tx.classSubject.deleteMany({
          where: { id: { in: removedRows.map((row) => row.id) } },
        });
      }

      const rows = await tx.subject.findMany({
        where: { workspaceId, classLinks: { some: { workspaceId, classId } } },
        select: subjectSelect,
        orderBy: [{ name: 'asc' }],
      });

      return {
        items: rows.map(toView),
        added,
        removed: removedRows.map((row) => row.subjectId),
      };
    });

    if (result.added.length > 0 || result.removed.length > 0) {
      await this.audit.record({
        type: AuditEventType.CLASS_SUBJECTS_CHANGED,
        actorUserId: actorId,
        workspaceId,
        targetId: classId,
        metadata: { added: result.added, removed: result.removed },
      });
    }

    return { items: result.items };
  }

  private buildUpdateData(dto: UpdateSubjectDto): Prisma.SubjectUncheckedUpdateInput {
    const data: Prisma.SubjectUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.code !== undefined) {
      data.code = nullableText(dto.code);
    }

    if (dto.description !== undefined) {
      data.description = nullableText(dto.description);
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return data;
  }
}
