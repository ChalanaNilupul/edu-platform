import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  LessonStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import type { ActiveMembership } from '../workspaces/workspace-access.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import type { CreateLessonDto } from './dto/create-lesson.dto.js';
import type { CreateMaterialDto } from './dto/create-material.dto.js';
import type { ListLessonsQueryDto } from './dto/list-lessons.query.js';
import type { ListWorkspaceLessonsQueryDto } from './dto/list-workspace-lessons.query.js';
import type { UpdateLessonDto } from './dto/update-lesson.dto.js';
import type { UpdateMaterialDto } from './dto/update-material.dto.js';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const WRITE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];

const materialSelect = {
  id: true,
  lessonId: true,
  title: true,
  kind: true,
  url: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LessonMaterialSelect;

const lessonListSelect = {
  id: true,
  classId: true,
  subjectId: true,
  title: true,
  description: true,
  lessonDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  subject: { select: { id: true, name: true } },
  createdBy: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  _count: { select: { materials: true } },
} satisfies Prisma.LessonSelect;

const lessonDetailSelect = {
  ...lessonListSelect,
  class: { select: { id: true, name: true, status: true } },
  materials: { select: materialSelect, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.LessonSelect;

const lessonHubSelect = {
  ...lessonListSelect,
  class: { select: { id: true, name: true, status: true } },
} satisfies Prisma.LessonSelect;

type MaterialRow = Prisma.LessonMaterialGetPayload<{ select: typeof materialSelect }>;
type LessonListRow = Prisma.LessonGetPayload<{ select: typeof lessonListSelect }>;
type LessonDetailRow = Prisma.LessonGetPayload<{ select: typeof lessonDetailSelect }>;
type LessonHubRow = Prisma.LessonGetPayload<{ select: typeof lessonHubSelect }>;

export type LessonAuthor = { membershipId: string; name: string };

export type LessonListView = Omit<LessonListRow, '_count' | 'lessonDate' | 'createdBy'> & {
  lessonDate: string;
  materialCount: number;
  createdBy: LessonAuthor | null;
};

export type LessonDetailView = Omit<
  LessonDetailRow,
  '_count' | 'lessonDate' | 'createdBy' | 'materials'
> & {
  lessonDate: string;
  materialCount: number;
  createdBy: LessonAuthor | null;
  materials: MaterialRow[];
};

export type LessonHubItemView = LessonListView & {
  class: { id: string; name: string; status: ClassStatus };
};

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseCalendarDate(value: string): Date {
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
    throw new BadRequestException('lessonDate must be a real calendar date');
  }

  return date;
}

function nullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.length === 0) {
    return null;
  }

  return value;
}

function normaliseUrl(value: string): string {
  const trimmed = value.trim();

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('url must be a valid http(s) URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('url must be a valid http(s) URL');
  }

  return trimmed;
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

function toAuthor(
  row: { id: string; user: { firstName: string; lastName: string | null } } | null,
) {
  if (!row) {
    return null;
  }

  return {
    membershipId: row.id,
    name: [row.user.firstName, row.user.lastName]
      .filter((part): part is string => Boolean(part))
      .join(' '),
  };
}

function toListView(row: LessonListRow): LessonListView {
  const { _count, lessonDate, createdBy, ...rest } = row;

  return {
    ...rest,
    lessonDate: formatCalendarDate(lessonDate),
    materialCount: _count.materials,
    createdBy: toAuthor(createdBy),
  };
}

function toDetailView(row: LessonDetailRow): LessonDetailView {
  const { _count, lessonDate, createdBy, materials, ...rest } = row;

  return {
    ...rest,
    lessonDate: formatCalendarDate(lessonDate),
    materialCount: _count.materials,
    createdBy: toAuthor(createdBy),
    materials,
  };
}

function changedLessonFields(
  existing: LessonDetailRow,
  data: Prisma.LessonUncheckedUpdateInput,
): Prisma.LessonUncheckedUpdateInput {
  const changed: Prisma.LessonUncheckedUpdateInput = {};

  for (const [field, value] of Object.entries(data)) {
    if (comparable(existing[field as keyof LessonDetailRow]) !== comparable(value)) {
      (changed as Record<string, unknown>)[field] = value;
    }
  }

  return changed;
}

function changedMaterialFields(
  existing: MaterialRow,
  data: Prisma.LessonMaterialUncheckedUpdateInput,
): Prisma.LessonMaterialUncheckedUpdateInput {
  const changed: Prisma.LessonMaterialUncheckedUpdateInput = {};

  for (const [field, value] of Object.entries(data)) {
    if (comparable(existing[field as keyof MaterialRow]) !== comparable(value)) {
      (changed as Record<string, unknown>)[field] = value;
    }
  }

  return changed;
}

@Injectable()
export class LessonsService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(actorId: string, workspaceId: string, classId: string, query: ListLessonsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);
      await this.requireClass(tx, workspaceId, classId);

      const where: Prisma.LessonWhereInput = { workspaceId, classId };

      if (query.status) {
        where.status = query.status;
      }

      const [rows, total] = await Promise.all([
        tx.lesson.findMany({
          where,
          select: lessonListSelect,
          orderBy: [{ lessonDate: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.lesson.count({ where }),
      ]);

      return {
        items: rows.map(toListView),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async listForWorkspace(
    actorId: string,
    workspaceId: string,
    query: ListWorkspaceLessonsQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? PAGE_SIZE, MAX_PAGE_SIZE);

    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const where: Prisma.LessonWhereInput = { workspaceId };

      if (query.classId) {
        where.classId = query.classId;
      }

      if (query.status) {
        where.status = query.status;
      }

      const [rows, total] = await Promise.all([
        tx.lesson.findMany({
          where,
          select: lessonHubSelect,
          orderBy: [{ lessonDate: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.lesson.count({ where }),
      ]);

      return {
        items: rows.map((row: LessonHubRow): LessonHubItemView => ({
          ...toListView(row),
          class: row.class,
        })),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    });
  }

  async findOne(actorId: string, workspaceId: string, lessonId: string) {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, READ_ROLES, tx);

      const row = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId },
        select: lessonDetailSelect,
      });

      if (!row) {
        throw new NotFoundException('Lesson not found');
      }

      return toDetailView(row);
    });
  }

  async create(actorId: string, workspaceId: string, classId: string, dto: CreateLessonDto) {
    const lessonDate = parseCalendarDate(dto.lessonDate);

    const created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const schoolClass = await this.requireClass(tx, workspaceId, classId);
      await this.requireWriter(tx, workspaceId, classId, membership);

      if (schoolClass.status !== ClassStatus.ACTIVE) {
        throw new ConflictException('Archived classes cannot receive new lessons');
      }

      if (dto.subjectId) {
        await this.requireClassSubject(tx, workspaceId, classId, dto.subjectId);
      }

      const row = await tx.lesson.create({
        data: {
          workspaceId,
          classId,
          subjectId: dto.subjectId ?? null,
          title: dto.title,
          description: nullableText(dto.description),
          lessonDate,
          status: dto.status ?? LessonStatus.DRAFT,
          createdByMembershipId: membership.id,
        },
        select: lessonDetailSelect,
      });

      return toDetailView(row);
    });

    await this.audit.record({
      type: AuditEventType.LESSON_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: { status: created.status, lessonDate: created.lessonDate },
    });

    return created;
  }

  async update(actorId: string, workspaceId: string, lessonId: string, dto: UpdateLessonDto) {
    const data = this.buildLessonUpdate(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const existing = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId },
        select: lessonDetailSelect,
      });

      if (!existing) {
        throw new NotFoundException('Lesson not found');
      }

      await this.requireWriter(tx, workspaceId, existing.classId, membership);

      if (typeof data.subjectId === 'string') {
        await this.requireClassSubject(tx, workspaceId, existing.classId, data.subjectId);
      }

      const changed = changedLessonFields(existing, data);

      if (Object.keys(changed).length === 0) {
        return { updated: toDetailView(existing), changed: [] as string[] };
      }

      const row = await tx.lesson.update({
        where: { id: existing.id },
        data: changed,
        select: lessonDetailSelect,
      });

      return { updated: toDetailView(row), changed: Object.keys(changed) };
    });

    if (result.changed.length > 0) {
      await this.audit.record({
        type: AuditEventType.LESSON_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: lessonId,
        metadata: { fields: result.changed },
      });
    }

    return result.updated;
  }

  async remove(actorId: string, workspaceId: string, lessonId: string) {
    await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const existing = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId },
        select: { id: true, classId: true },
      });

      if (!existing) {
        throw new NotFoundException('Lesson not found');
      }

      await this.requireWriter(tx, workspaceId, existing.classId, membership);

      await tx.lesson.delete({ where: { id: existing.id } });
    });

    await this.audit.record({
      type: AuditEventType.LESSON_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: lessonId,
    });
  }

  async addMaterial(
    actorId: string,
    workspaceId: string,
    lessonId: string,
    dto: CreateMaterialDto,
  ) {
    const url = normaliseUrl(dto.url);

    const created = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const lesson = await this.requireLesson(tx, workspaceId, lessonId);
      await this.requireWriter(tx, workspaceId, lesson.classId, membership);

      return tx.lessonMaterial.create({
        data: {
          workspaceId,
          lessonId,
          title: dto.title,
          kind: dto.kind,
          url,
          description: nullableText(dto.description),
        },
        select: materialSelect,
      });
    });

    await this.audit.record({
      type: AuditEventType.LESSON_MATERIAL_CREATED,
      actorUserId: actorId,
      workspaceId,
      targetId: created.id,
      metadata: { lessonId, kind: created.kind },
    });

    return created;
  }

  async updateMaterial(
    actorId: string,
    workspaceId: string,
    materialId: string,
    dto: UpdateMaterialDto,
  ) {
    const data = this.buildMaterialUpdate(dto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const existing = await tx.lessonMaterial.findFirst({
        where: { id: materialId, workspaceId },
        select: { ...materialSelect, lesson: { select: { classId: true } } },
      });

      if (!existing) {
        throw new NotFoundException('Material not found');
      }

      const { lesson, ...current } = existing;

      await this.requireWriter(tx, workspaceId, lesson.classId, membership);

      const changed = changedMaterialFields(current, data);

      if (Object.keys(changed).length === 0) {
        return { updated: current, changed: [] as string[] };
      }

      const row = await tx.lessonMaterial.update({
        where: { id: existing.id },
        data: changed,
        select: materialSelect,
      });

      return { updated: row, changed: Object.keys(changed) };
    });

    if (result.changed.length > 0) {
      await this.audit.record({
        type: AuditEventType.LESSON_MATERIAL_UPDATED,
        actorUserId: actorId,
        workspaceId,
        targetId: materialId,
        metadata: { fields: result.changed },
      });
    }

    return result.updated;
  }

  async removeMaterial(actorId: string, workspaceId: string, materialId: string) {
    await this.tenant.runAsTenant(workspaceId, async (tx) => {
      const membership = await this.workspaceAccess.requireRoles(
        actorId,
        workspaceId,
        WRITE_ROLES,
        tx,
      );

      const existing = await tx.lessonMaterial.findFirst({
        where: { id: materialId, workspaceId },
        select: { id: true, lesson: { select: { classId: true } } },
      });

      if (!existing) {
        throw new NotFoundException('Material not found');
      }

      await this.requireWriter(tx, workspaceId, existing.lesson.classId, membership);

      await tx.lessonMaterial.delete({ where: { id: existing.id } });
    });

    await this.audit.record({
      type: AuditEventType.LESSON_MATERIAL_DELETED,
      actorUserId: actorId,
      workspaceId,
      targetId: materialId,
    });
  }

  private buildLessonUpdate(dto: UpdateLessonDto): Prisma.LessonUncheckedUpdateInput {
    const data: Prisma.LessonUncheckedUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
    }

    if (dto.description !== undefined) {
      data.description = nullableText(dto.description);
    }

    if (dto.lessonDate !== undefined) {
      data.lessonDate = parseCalendarDate(dto.lessonDate);
    }

    if (dto.subjectId !== undefined) {
      data.subjectId = dto.subjectId;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return data;
  }

  private buildMaterialUpdate(dto: UpdateMaterialDto): Prisma.LessonMaterialUncheckedUpdateInput {
    const data: Prisma.LessonMaterialUncheckedUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
    }

    if (dto.kind !== undefined) {
      data.kind = dto.kind;
    }

    if (dto.url !== undefined) {
      data.url = normaliseUrl(dto.url);
    }

    if (dto.description !== undefined) {
      data.description = nullableText(dto.description);
    }

    return data;
  }

  private async requireClass(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
  ): Promise<{ id: string; status: ClassStatus }> {
    const schoolClass = await tx.class.findFirst({
      where: { id: classId, workspaceId },
      select: { id: true, status: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  private async requireLesson(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    lessonId: string,
  ): Promise<{ id: string; classId: string }> {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId, workspaceId },
      select: { id: true, classId: true },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return lesson;
  }

  private async requireClassSubject(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    classId: string,
    subjectId: string,
  ) {
    const link = await tx.classSubject.findFirst({
      where: { workspaceId, classId, subjectId },
      select: { id: true },
    });

    if (!link) {
      throw new BadRequestException('Subject is not linked to this class');
    }
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
      throw new ForbiddenException("Only this class's teachers can manage lessons");
    }
  }
}
