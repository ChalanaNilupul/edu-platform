import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import { AuditEventType, ClassStatus, Prisma, WorkspaceRole } from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { ClassesService } from './classes.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const CLASS_ID = 'class-123';

const classRow = {
  id: CLASS_ID,
  name: 'Grade 8 Science',
  grade: 'Grade 8',
  description: null,
  capacity: 30,
  status: ClassStatus.ACTIVE,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  _count: { enrollments: 4 },
};

const READ_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER];
const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
  });
}

describe('ClassesService', () => {
  const tx = {
    class: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: {
      count: vi.fn(),
    },
    classTeacher: {
      count: vi.fn(),
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

  let service: ClassesService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    service = new ClassesService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('list', () => {
    it('requires a staff role and applies search, filter and pagination', async () => {
      tx.class.findMany.mockResolvedValue([classRow]);
      tx.class.count.mockResolvedValue(21);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, {
        search: '  science ',
        status: ClassStatus.ACTIVE,
        page: 2,
        pageSize: 10,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        READ_ROLES,
        tx,
      );
      expect(tx.class.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          status: ClassStatus.ACTIVE,
          OR: [
            { name: { contains: 'science', mode: 'insensitive' } },
            { grade: { contains: 'science', mode: 'insensitive' } },
            { description: { contains: 'science', mode: 'insensitive' } },
          ],
        },
        select: expect.any(Object),
        orderBy: [{ name: 'asc' }],
        skip: 10,
        take: 10,
      });
      expect(result.items).toEqual([
        {
          id: CLASS_ID,
          name: 'Grade 8 Science',
          grade: 'Grade 8',
          description: null,
          capacity: 30,
          status: ClassStatus.ACTIVE,
          createdAt: classRow.createdAt,
          updatedAt: classRow.updatedAt,
          enrolledCount: 4,
        },
      ]);
      expect(result).toMatchObject({ page: 2, pageSize: 10, total: 21, totalPages: 3 });
    });

    it('lists without filters and caps the page size', async () => {
      tx.class.findMany.mockResolvedValue([]);
      tx.class.count.mockResolvedValue(0);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, { pageSize: 500 });

      expect(tx.class.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: WORKSPACE_ID },
          skip: 0,
          take: 100,
        }),
      );
      expect(result).toMatchObject({ items: [], page: 1, pageSize: 100, totalPages: 0 });
    });

    it('propagates role failures', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(new Error('forbidden'));

      await expect(service.list(ACTOR_ID, WORKSPACE_ID, {})).rejects.toThrow('forbidden');
    });
  });

  describe('findOne', () => {
    it('returns a class with its active enrollment count', async () => {
      tx.class.findFirst.mockResolvedValue(classRow);

      const result = await service.findOne(ACTOR_ID, WORKSPACE_ID, CLASS_ID);

      expect(tx.class.findFirst).toHaveBeenCalledWith({
        where: { id: CLASS_ID, workspaceId: WORKSPACE_ID },
        select: expect.any(Object),
      });
      expect(result.enrolledCount).toBe(4);
      expect(result).not.toHaveProperty('_count');
    });

    it('throws when the class is not in the workspace', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, CLASS_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a class with blank optionals cleared and records an audit event', async () => {
      tx.class.create.mockResolvedValue(classRow);

      const result = await service.create(ACTOR_ID, WORKSPACE_ID, {
        name: 'Grade 8 Science',
        grade: '',
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        MANAGE_ROLES,
        tx,
      );
      expect(tx.class.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          name: 'Grade 8 Science',
          grade: null,
          description: null,
          capacity: null,
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: CLASS_ID,
        metadata: { status: ClassStatus.ACTIVE },
      });
      expect(result.enrolledCount).toBe(4);
    });

    it('rejects a duplicate class name', async () => {
      tx.class.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, { name: 'Grade 8 Science' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects an empty payload', async () => {
      await expect(service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tenantMock.runAsTenant).not.toHaveBeenCalled();
    });

    it('writes nothing when the payload matches the stored class', async () => {
      tx.class.findFirst.mockResolvedValue(classRow);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        name: 'Grade 8 Science',
        status: ClassStatus.ACTIVE,
        capacity: 30,
      });

      expect(tx.class.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result.enrolledCount).toBe(4);
    });

    it('updates changed fields and audits their names', async () => {
      tx.class.findFirst.mockResolvedValue(classRow);
      tx.class.update.mockResolvedValue({
        ...classRow,
        name: 'Grade 8 Maths',
        status: ClassStatus.ARCHIVED,
      });

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, {
        name: 'Grade 8 Maths',
        status: ClassStatus.ARCHIVED,
        capacity: 30,
      });

      expect(tx.class.update).toHaveBeenCalledWith({
        where: { id: CLASS_ID },
        data: { name: 'Grade 8 Maths', status: ClassStatus.ARCHIVED },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: CLASS_ID,
        metadata: { fields: ['name', 'status'] },
      });
      expect(result.name).toBe('Grade 8 Maths');
    });

    it('clears an optional field when null is sent', async () => {
      tx.class.findFirst.mockResolvedValue(classRow);
      tx.class.update.mockResolvedValue({ ...classRow, capacity: null });

      await service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { capacity: null });

      expect(tx.class.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { capacity: null } }),
      );
    });

    it('rejects a duplicate name', async () => {
      tx.class.findFirst.mockResolvedValue(classRow);
      tx.class.update.mockRejectedValue(uniqueViolation());

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { name: 'Taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws when the class is missing', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, CLASS_ID, { name: 'Grade 9' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('refuses to delete a class that has enrollment records', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.enrollment.count.mockResolvedValue(2);
      tx.classTeacher.count.mockResolvedValue(0);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.class.delete).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('refuses to delete a class that has teacher assignments', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.enrollment.count.mockResolvedValue(0);
      tx.classTeacher.count.mockResolvedValue(1);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.class.delete).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('deletes an empty class and records an audit event', async () => {
      tx.class.findFirst.mockResolvedValue({ id: CLASS_ID });
      tx.enrollment.count.mockResolvedValue(0);
      tx.classTeacher.count.mockResolvedValue(0);

      await service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID);

      expect(tx.class.delete).toHaveBeenCalledWith({ where: { id: CLASS_ID } });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.CLASS_DELETED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: CLASS_ID,
      });
    });

    it('throws when the class is missing', async () => {
      tx.class.findFirst.mockResolvedValue(null);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, CLASS_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
