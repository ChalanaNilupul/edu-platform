import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  LessonStatus,
  MaterialKind,
  MembershipStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { LessonsService } from './lessons.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const MEMBERSHIP_ID = 'membership-123';
const CLASS_ID = 'class-123';
const SUBJECT_ID = 'subject-123';
const LESSON_ID = 'lesson-123';
const MATERIAL_ID = 'material-123';

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const WRITE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];

const lessonDate = new Date('2026-11-10T00:00:00.000Z');
const createdAt = new Date('2026-11-01T10:00:00.000Z');

const lessonListRow = {
  id: LESSON_ID,
  classId: CLASS_ID,
  subjectId: SUBJECT_ID,
  title: 'Fractions',
  description: null,
  lessonDate,
  status: LessonStatus.DRAFT,
  createdAt,
  updatedAt: createdAt,
  subject: { id: SUBJECT_ID, name: 'Mathematics' },
  createdBy: null,
  _count: { materials: 0 },
};

const lessonDetailRow = {
  ...lessonListRow,
  class: { id: CLASS_ID, name: 'Grade 8', status: ClassStatus.ACTIVE },
  materials: [],
};

const materialRow = {
  id: MATERIAL_ID,
  lessonId: LESSON_ID,
  title: 'Fractions worksheet',
  kind: MaterialKind.PDF,
  url: 'https://example.com/fractions.pdf',
  description: null,
  createdAt,
  updatedAt: createdAt,
};

describe('LessonsService', () => {
  const tx = {
    lesson: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    lessonMaterial: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    class: { findFirst: vi.fn() },
    classSubject: { findFirst: vi.fn() },
    classTeacher: { findFirst: vi.fn() },
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

  let service: LessonsService;

  function membership(role: WorkspaceRole) {
    return { id: MEMBERSHIP_ID, role, status: MembershipStatus.ACTIVE };
  }

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    workspaceAccessMock.requireRoles.mockResolvedValue(membership(WorkspaceRole.ADMIN));

    tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
    tx.classSubject.findFirst.mockResolvedValue({ id: 'link-1' });

    service = new LessonsService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('list', () => {
    it('filters by status and paginates', async () => {
      tx.lesson.findMany.mockResolvedValue([lessonListRow]);
      tx.lesson.count.mockResolvedValue(25);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        status: LessonStatus.PUBLISHED,
        page: 2,
        pageSize: 10,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        READ_ROLES,
        tx,
      );
      expect(tx.lesson.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, classId: CLASS_ID, status: LessonStatus.PUBLISHED },
        select: expect.any(Object),
        orderBy: [{ lessonDate: 'desc' }, { createdAt: 'desc' }],
        skip: 10,
        take: 10,
      });
      expect(result).toMatchObject({ page: 2, pageSize: 10, total: 25, totalPages: 3 });
      expect(result.items[0]).toMatchObject({
        id: LESSON_ID,
        lessonDate: '2026-11-10',
        materialCount: 0,
        createdBy: null,
      });
    });

    it('rejects unknown classes', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(service.list(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a draft lesson and records an audit event', async () => {
      tx.lesson.create.mockResolvedValue(lessonDetailRow);

      const result = await service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        title: 'Fractions',
        lessonDate: '2026-11-10',
        subjectId: SUBJECT_ID,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        WRITE_ROLES,
        tx,
      );
      expect(tx.lesson.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          classId: CLASS_ID,
          subjectId: SUBJECT_ID,
          title: 'Fractions',
          description: null,
          lessonDate,
          status: LessonStatus.DRAFT,
          createdByMembershipId: MEMBERSHIP_ID,
        },
        select: expect.any(Object),
      });
      expect(result).toMatchObject({ id: LESSON_ID, lessonDate: '2026-11-10' });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.LESSON_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: LESSON_ID,
        metadata: { status: LessonStatus.DRAFT, lessonDate: '2026-11-10' },
      });
    });

    it('rejects lessons for archived classes', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ARCHIVED });

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
          title: 'Fractions',
          lessonDate: '2026-11-10',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.lesson.create).not.toHaveBeenCalled();
    });

    it('rejects subjects that are not linked to the class', async () => {
      tx.classSubject.findFirst.mockResolvedValue(null);

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
          title: 'Fractions',
          lessonDate: '2026-11-10',
          subjectId: SUBJECT_ID,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects impossible calendar dates', async () => {
      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
          title: 'Fractions',
          lessonDate: '2026-02-30',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lets only assigned teachers write as a teacher', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue(membership(WorkspaceRole.TEACHER));
      tx.classTeacher.findFirst.mockResolvedValue(null);

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
          title: 'Fractions',
          lessonDate: '2026-11-10',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(tx.lesson.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('writes only changed fields and audits them', async () => {
      tx.lesson.findFirst.mockResolvedValue(lessonDetailRow);
      tx.lesson.update.mockResolvedValue({
        ...lessonDetailRow,
        title: 'Advanced fractions',
        status: LessonStatus.PUBLISHED,
      });

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, LESSON_ID, {
        title: 'Advanced fractions',
        status: LessonStatus.PUBLISHED,
        description: null,
      });

      expect(tx.lesson.update).toHaveBeenCalledWith({
        where: { id: LESSON_ID },
        data: { title: 'Advanced fractions', status: LessonStatus.PUBLISHED },
        select: expect.any(Object),
      });
      expect(result).toMatchObject({ title: 'Advanced fractions', status: LessonStatus.PUBLISHED });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.LESSON_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: LESSON_ID,
        metadata: { fields: ['title', 'status'] },
      });
    });

    it('skips the write when nothing changes', async () => {
      tx.lesson.findFirst.mockResolvedValue(lessonDetailRow);

      await service.update(ACTOR_ID, WORKSPACE_ID, LESSON_ID, { title: 'Fractions' });

      expect(tx.lesson.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('clears the subject with an explicit null', async () => {
      tx.lesson.findFirst.mockResolvedValue(lessonDetailRow);
      tx.lesson.update.mockResolvedValue({ ...lessonDetailRow, subjectId: null, subject: null });

      await service.update(ACTOR_ID, WORKSPACE_ID, LESSON_ID, { subjectId: null });

      expect(tx.classSubject.findFirst).not.toHaveBeenCalled();
      expect(tx.lesson.update).toHaveBeenCalledWith({
        where: { id: LESSON_ID },
        data: { subjectId: null },
        select: expect.any(Object),
      });
    });

    it('rejects empty patches and missing lessons', async () => {
      await expect(service.update(ACTOR_ID, WORKSPACE_ID, LESSON_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      tx.lesson.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, LESSON_ID, { title: 'New' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the lesson and audits it', async () => {
      tx.lesson.findFirst.mockResolvedValue({ id: LESSON_ID, classId: CLASS_ID });

      await service.remove(ACTOR_ID, WORKSPACE_ID, LESSON_ID);

      expect(tx.lesson.delete).toHaveBeenCalledWith({ where: { id: LESSON_ID } });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.LESSON_DELETED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: LESSON_ID,
      });
    });
  });

  describe('materials', () => {
    it('adds a material and audits its kind', async () => {
      tx.lesson.findFirst.mockResolvedValue({ id: LESSON_ID, classId: CLASS_ID });
      tx.lessonMaterial.create.mockResolvedValue(materialRow);

      const result = await service.addMaterial(ACTOR_ID, WORKSPACE_ID, LESSON_ID, {
        title: 'Fractions worksheet',
        kind: MaterialKind.PDF,
        url: 'https://example.com/fractions.pdf',
      });

      expect(tx.lessonMaterial.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          lessonId: LESSON_ID,
          title: 'Fractions worksheet',
          kind: MaterialKind.PDF,
          url: 'https://example.com/fractions.pdf',
          description: null,
        },
        select: expect.any(Object),
      });
      expect(result).toMatchObject({ id: MATERIAL_ID, kind: MaterialKind.PDF });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.LESSON_MATERIAL_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: MATERIAL_ID,
        metadata: { lessonId: LESSON_ID, kind: MaterialKind.PDF },
      });
    });

    it('rejects non-http urls before hitting the database', async () => {
      for (const url of ['not-a-url', 'ftp://example.com/file.pdf', 'javascript:alert(1)']) {
        await expect(
          service.addMaterial(ACTOR_ID, WORKSPACE_ID, LESSON_ID, {
            title: 'Broken',
            kind: MaterialKind.LINK,
            url,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }

      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('updates a material and audits the changed fields', async () => {
      tx.lessonMaterial.findFirst.mockResolvedValue({
        ...materialRow,
        lesson: { classId: CLASS_ID },
      });
      tx.lessonMaterial.update.mockResolvedValue({ ...materialRow, title: 'Worksheet v2' });

      const result = await service.updateMaterial(ACTOR_ID, WORKSPACE_ID, MATERIAL_ID, {
        title: 'Worksheet v2',
      });

      expect(tx.lessonMaterial.update).toHaveBeenCalledWith({
        where: { id: MATERIAL_ID },
        data: { title: 'Worksheet v2' },
        select: expect.any(Object),
      });
      expect(result).toMatchObject({ title: 'Worksheet v2' });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.LESSON_MATERIAL_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: MATERIAL_ID,
        metadata: { fields: ['title'] },
      });
    });

    it('removes a material and audits it', async () => {
      tx.lessonMaterial.findFirst.mockResolvedValue({
        id: MATERIAL_ID,
        lesson: { classId: CLASS_ID },
      });

      await service.removeMaterial(ACTOR_ID, WORKSPACE_ID, MATERIAL_ID);

      expect(tx.lessonMaterial.delete).toHaveBeenCalledWith({ where: { id: MATERIAL_ID } });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.LESSON_MATERIAL_DELETED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: MATERIAL_ID,
      });
    });

    it('rejects materials of unknown lessons', async () => {
      tx.lesson.findFirst.mockResolvedValue(null);

      await expect(
        service.addMaterial(ACTOR_ID, WORKSPACE_ID, LESSON_ID, {
          title: 'Slides',
          kind: MaterialKind.LINK,
          url: 'https://example.com/slides',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
