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
  MembershipStatus,
  Prisma,
  StudentStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { StudentsService } from './students.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const STUDENT_ID = 'student-123';

const student = {
  id: STUDENT_ID,
  studentCode: 'STU-001',
  firstName: 'Nimal',
  lastName: 'Perera',
  dateOfBirth: new Date('2010-05-14'),
  gender: 'MALE',
  email: 'nimal@example.com',
  phone: '+94770000000',
  addressLine1: '1 School Lane',
  addressLine2: null,
  city: 'Colombo',
  district: 'Colombo',
  postalCode: '10000',
  school: 'Central College',
  grade: 'Grade 8',
  status: StudentStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('StudentsService', () => {
  const tx = {
    student: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

  let service: StudentsService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    service = new StudentsService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('list', () => {
    it('requires a staff role and applies search, filter and pagination', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findMany.mockResolvedValue([student]);
      tx.student.count.mockResolvedValue(21);

      const result = await service.list(ACTOR_ID, WORKSPACE_ID, {
        search: '  nimal ',
        status: StudentStatus.ACTIVE,
        page: 2,
        pageSize: 10,
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER],
        tx,
      );
      expect(tx.student.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          status: StudentStatus.ACTIVE,
          OR: [
            { firstName: { contains: 'nimal', mode: 'insensitive' } },
            { lastName: { contains: 'nimal', mode: 'insensitive' } },
            { studentCode: { contains: 'nimal', mode: 'insensitive' } },
            { email: { contains: 'nimal', mode: 'insensitive' } },
            { phone: { contains: 'nimal' } },
          ],
        },
        select: expect.any(Object),
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: 10,
        take: 10,
      });
      expect(tx.student.count).toHaveBeenCalledWith({
        where: {
          workspaceId: WORKSPACE_ID,
          status: StudentStatus.ACTIVE,
          OR: expect.any(Array),
        },
      });
      expect(result).toEqual({
        items: [student],
        page: 2,
        pageSize: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('propagates the access check failure', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(
        new ForbiddenException('You do not have permission to perform this action'),
      );

      await expect(service.list(ACTOR_ID, WORKSPACE_ID, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tx.student.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('requires a staff role and returns the student', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(student);

      const result = await service.findOne(ACTOR_ID, WORKSPACE_ID, STUDENT_ID);

      expect(tx.student.findFirst).toHaveBeenCalledWith({
        where: { id: STUDENT_ID, workspaceId: WORKSPACE_ID },
        select: expect.any(Object),
      });
      expect(result).toEqual(student);
    });

    it('throws when the student does not exist in the workspace', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(null);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, STUDENT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('requires a managing role, creates the student and records an audit event', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.create.mockResolvedValue(student);

      const result = await service.create(ACTOR_ID, WORKSPACE_ID, {
        firstName: 'Nimal',
        lastName: 'Perera',
        studentCode: 'STU-001',
        dateOfBirth: '2010-05-14',
        email: 'nimal@example.com',
        phone: '+94770000000',
        city: 'Colombo',
        grade: 'Grade 8',
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER],
        tx,
      );
      expect(tx.student.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          firstName: 'Nimal',
          lastName: 'Perera',
          studentCode: 'STU-001',
          dateOfBirth: new Date('2010-05-14'),
          gender: null,
          email: 'nimal@example.com',
          phone: '+94770000000',
          addressLine1: null,
          addressLine2: null,
          city: 'Colombo',
          district: null,
          postalCode: null,
          school: null,
          grade: 'Grade 8',
        },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.STUDENT_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: STUDENT_ID,
      });
      expect(result).toEqual(student);
    });

    it('treats blank optional values as null', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.create.mockResolvedValue(student);

      await service.create(ACTOR_ID, WORKSPACE_ID, {
        firstName: 'Nimal',
        lastName: '',
        email: '',
        phone: '',
      });

      expect(tx.student.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastName: null,
            email: null,
            phone: null,
          }),
        }),
      );
    });

    it('maps a duplicate student code to a conflict', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );

      await expect(
        service.create(ACTOR_ID, WORKSPACE_ID, { firstName: 'Nimal', studentCode: 'STU-001' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('requires a managing role, updates fields and records an audit event', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.BRANCH_MANAGER,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(student);
      tx.student.update.mockResolvedValue({ ...student, grade: 'Grade 9' });

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
        grade: 'Grade 9',
      });

      expect(tx.student.update).toHaveBeenCalledWith({
        where: { id: STUDENT_ID },
        data: { grade: 'Grade 9' },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.STUDENT_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: STUDENT_ID,
        metadata: { fields: ['grade'] },
      });
      expect(result.grade).toBe('Grade 9');
    });

    it('records a status change when the status differs', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(student);
      tx.student.update.mockResolvedValue({ ...student, status: StudentStatus.WITHDRAWN });

      await service.update(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
        status: StudentStatus.WITHDRAWN,
      });

      expect(auditMock.record).toHaveBeenCalledTimes(1);
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.STUDENT_STATUS_CHANGED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: STUDENT_ID,
        metadata: { from: StudentStatus.ACTIVE, to: StudentStatus.WITHDRAWN },
      });
    });

    it('skips the write and the audit event when nothing changes', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(student);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
        grade: 'Grade 8',
        city: 'Colombo',
        dateOfBirth: '2010-05-14',
        studentCode: 'STU-001',
      });

      expect(tx.student.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result).toEqual(student);
    });

    it('rejects an empty update before touching the database', async () => {
      await expect(service.update(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(workspaceAccessMock.requireRoles).not.toHaveBeenCalled();
      expect(tx.student.update).not.toHaveBeenCalled();
    });

    it('throws when the student does not exist in the workspace', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, { grade: 'Grade 9' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.student.update).not.toHaveBeenCalled();
    });

    it('maps a duplicate student code to a conflict', async () => {
      workspaceAccessMock.requireRoles.mockResolvedValue({
        id: 'membership-123',
        role: WorkspaceRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      });
      tx.student.findFirst.mockResolvedValue(student);
      tx.student.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.1',
        }),
      );

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, { studentCode: 'STU-002' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });
});
