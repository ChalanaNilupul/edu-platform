import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import {
  AuditEventType,
  ClassStatus,
  MembershipStatus,
  Prisma,
  SubjectStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { SubjectsService } from './subjects.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const SUBJECT_ID = 'subject-123';
const OTHER_SUBJECT_ID = 'subject-456';
const CLASS_ID = 'class-123';

const subjectRow = {
  id: SUBJECT_ID,
  name: 'Mathematics',
  code: 'MATH',
  description: null,
  status: SubjectStatus.ACTIVE,
  createdAt: new Date('2026-01-05T10:00:00.000Z'),
  updatedAt: new Date('2026-01-05T10:00:00.000Z'),
  _count: { classLinks: 2 },
};

const subjectView = {
  id: SUBJECT_ID,
  name: 'Mathematics',
  code: 'MATH',
  description: null,
  status: SubjectStatus.ACTIVE,
  createdAt: subjectRow.createdAt,
  updatedAt: subjectRow.updatedAt,
  classCount: 2,
};

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
  });
}

describe('SubjectsService', () => {
  const tx = {
    subject: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    class: { findFirst: vi.fn() },
    classSubject: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
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

  let service: SubjectsService;

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

    tx.classSubject.findMany.mockResolvedValue([]);

    service = new SubjectsService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('list', () => {
    it('applies search, status and pagination', async () => {
      tx.subject.findMany.mockResolvedValue([subjectRow]);
      tx.subject.count.mockResolvedValue(25);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, {
        search: ' math ',
        status: SubjectStatus.ACTIVE,
        page: 2,
        pageSize: 10,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        READ_ROLES,
        tx,
      );
      expect(tx.subject.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          status: SubjectStatus.ACTIVE,
          OR: [
            { name: { contains: 'math', mode: 'insensitive' } },
            { code: { contains: 'math', mode: 'insensitive' } },
            { description: { contains: 'math', mode: 'insensitive' } },
          ],
        },
        select: expect.any(Object),
        orderBy: [{ name: 'asc' }],
        skip: 10,
        take: 10,
      });
      expect(result).toEqual({
        items: [subjectView],
        page: 2,
        pageSize: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('defaults to the first page and caps the page size', async () => {
      tx.subject.findMany.mockResolvedValue([]);
      tx.subject.count.mockResolvedValue(0);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, { pageSize: 500 });

      expect(tx.subject.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
      expect(result).toMatchObject({ page: 1, pageSize: 100, totalPages: 0 });
    });
  });

  describe('findOne', () => {
    it('returns the subject with its class count', async () => {
      tx.subject.findFirst.mockResolvedValue(subjectRow);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID)).resolves.toEqual(
        subjectView,
      );
      expect(tx.subject.findFirst).toHaveBeenCalledWith({
        where: { id: SUBJECT_ID, workspaceId: WORKSPACE_ID },
        select: expect.any(Object),
      });
    });

    it('returns 404 for an unknown subject', async () => {
      tx.subject.findFirst.mockResolvedValue(null);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a subject and records an audit event', async () => {
      tx.subject.findFirst.mockResolvedValue(null);
      tx.subject.create.mockResolvedValue(subjectRow);

      const result = await service.create(ACTOR_ID, WORKSPACE_ID, {
        name: 'Mathematics',
        code: 'MATH',
        description: '',
      });

      expect(tx.subject.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          name: 'Mathematics',
          code: 'MATH',
          description: null,
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.SUBJECT_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: SUBJECT_ID,
        metadata: { status: SubjectStatus.ACTIVE },
      });
      expect(result).toEqual(subjectView);
    });

    it('rejects a duplicate name', async () => {
      tx.subject.findFirst.mockResolvedValueOnce({ id: OTHER_SUBJECT_ID });

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, { name: 'Mathematics' })).rejects.toThrow(
        new ConflictException('A subject with this name already exists'),
      );
      expect(tx.subject.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate code', async () => {
      tx.subject.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: OTHER_SUBJECT_ID });

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, { name: 'Mathematics', code: 'MATH' }),
      ).rejects.toThrow(new ConflictException('A subject with this code already exists'));
    });

    it('maps a unique violation to a conflict', async () => {
      tx.subject.findFirst.mockResolvedValue(null);
      tx.subject.create.mockRejectedValue(uniqueViolation());

      await expect(service.create(ACTOR_ID, WORKSPACE_ID, { name: 'Mathematics' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('updates changed fields and audits their names', async () => {
      tx.subject.findFirst.mockResolvedValueOnce(subjectRow).mockResolvedValueOnce(null);
      tx.subject.update.mockResolvedValue({ ...subjectRow, name: 'Advanced Mathematics' });

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID, {
        name: 'Advanced Mathematics',
      });

      expect(tx.subject.update).toHaveBeenCalledWith({
        where: { id: SUBJECT_ID },
        data: { name: 'Advanced Mathematics' },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.SUBJECT_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: SUBJECT_ID,
        metadata: { fields: ['name'] },
      });
      expect(result.name).toBe('Advanced Mathematics');
    });

    it('skips the update and audit when nothing changed', async () => {
      tx.subject.findFirst.mockResolvedValue(subjectRow);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID, {
        name: 'Mathematics',
      });

      expect(tx.subject.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result).toEqual(subjectView);
    });

    it('records archiving under its own event', async () => {
      tx.subject.findFirst.mockResolvedValue(subjectRow);
      tx.subject.update.mockResolvedValue({ ...subjectRow, status: SubjectStatus.ARCHIVED });

      await service.update(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID, {
        status: SubjectStatus.ARCHIVED,
      });

      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: AuditEventType.SUBJECT_ARCHIVED }),
      );
    });

    it('rejects a name that another subject already uses', async () => {
      tx.subject.findFirst
        .mockResolvedValueOnce(subjectRow)
        .mockResolvedValueOnce({ id: OTHER_SUBJECT_ID });

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID, { name: 'Science' }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an empty payload', async () => {
      await expect(service.update(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns 404 for an unknown subject', async () => {
      tx.subject.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID, { name: 'Science' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a subject with no class links', async () => {
      tx.subject.findFirst.mockResolvedValue({ id: SUBJECT_ID });
      tx.classSubject.count.mockResolvedValue(0);

      await service.remove(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID);

      expect(tx.subject.delete).toHaveBeenCalledWith({ where: { id: SUBJECT_ID } });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.SUBJECT_DELETED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: SUBJECT_ID,
      });
    });

    it('refuses to delete a subject that classes still use', async () => {
      tx.subject.findFirst.mockResolvedValue({ id: SUBJECT_ID });
      tx.classSubject.count.mockResolvedValue(2);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(tx.subject.delete).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown subject', async () => {
      tx.subject.findFirst.mockResolvedValue(null);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, SUBJECT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listForClass', () => {
    it('returns the subjects linked to a class', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.subject.findMany.mockResolvedValue([subjectRow]);

      const result = await service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID);

      expect(tx.subject.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          classLinks: { some: { workspaceId: WORKSPACE_ID, classId: CLASS_ID } },
        },
        select: expect.any(Object),
        orderBy: [{ name: 'asc' }],
      });
      expect(result).toEqual({ items: [subjectView] });
    });

    it('returns 404 for a class outside the workspace', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(service.listForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('replaceForClass', () => {
    it('adds new links and removes dropped ones, then audits the change', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.subject.findMany
        .mockResolvedValueOnce([{ id: OTHER_SUBJECT_ID, status: SubjectStatus.ACTIVE }])
        .mockResolvedValueOnce([subjectRow]);
      tx.classSubject.findMany.mockResolvedValue([{ id: 'link-1', subjectId: SUBJECT_ID }]);

      const result = await service.replaceForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, [
        OTHER_SUBJECT_ID,
      ]);

      expect(tx.classSubject.createMany).toHaveBeenCalledWith({
        data: [{ workspaceId: WORKSPACE_ID, classId: CLASS_ID, subjectId: OTHER_SUBJECT_ID }],
      });
      expect(tx.classSubject.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['link-1'] } },
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_SUBJECTS_CHANGED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: CLASS_ID,
        metadata: { added: [OTHER_SUBJECT_ID], removed: [SUBJECT_ID] },
      });
      expect(result).toEqual({ items: [subjectView] });
    });

    it('writes nothing when the selection is unchanged', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.subject.findMany
        .mockResolvedValueOnce([{ id: SUBJECT_ID, status: SubjectStatus.ACTIVE }])
        .mockResolvedValueOnce([subjectRow]);
      tx.classSubject.findMany.mockResolvedValue([{ id: 'link-1', subjectId: SUBJECT_ID }]);

      await service.replaceForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, [SUBJECT_ID, SUBJECT_ID]);

      expect(tx.classSubject.createMany).not.toHaveBeenCalled();
      expect(tx.classSubject.deleteMany).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('rejects archived classes', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ARCHIVED });

      await expect(
        service.replaceForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, [SUBJECT_ID]),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects subject ids from outside the workspace', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.subject.findMany.mockResolvedValue([]);

      await expect(
        service.replaceForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, [SUBJECT_ID]),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects newly linking an archived subject', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.subject.findMany.mockResolvedValue([{ id: SUBJECT_ID, status: SubjectStatus.ARCHIVED }]);

      await expect(
        service.replaceForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, [SUBJECT_ID]),
      ).rejects.toThrow(new ConflictException('Archived subjects cannot be assigned to a class'));
    });

    it('keeps an existing archived link when the selection is saved unchanged', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID, status: ClassStatus.ACTIVE });
      tx.classSubject.findMany.mockResolvedValue([{ id: 'link-1', subjectId: SUBJECT_ID }]);
      tx.subject.findMany
        .mockResolvedValueOnce([{ id: SUBJECT_ID, status: SubjectStatus.ARCHIVED }])
        .mockResolvedValueOnce([{ ...subjectRow, status: SubjectStatus.ARCHIVED }]);

      const result = await service.replaceForClass(ACTOR_ID, WORKSPACE_ID, CLASS_ID, [SUBJECT_ID]);

      expect(tx.classSubject.createMany).not.toHaveBeenCalled();
      expect(tx.classSubject.deleteMany).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });
  });
});
