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
  GuardianRelationship,
  MembershipStatus,
  WorkspaceRole,
} from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { GuardiansService } from './guardians.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';
const STUDENT_ID = 'student-123';
const GUARDIAN_ID = 'guardian-123';
const LINK_ID = 'link-123';

const guardian = {
  id: GUARDIAN_ID,
  firstName: 'Sunil',
  lastName: 'Perera',
  relationship: GuardianRelationship.FATHER,
  email: 'sunil@example.com',
  phone: '+94770000002',
  occupation: 'Teacher',
  addressLine1: null,
  addressLine2: null,
  city: null,
  district: null,
  postalCode: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GuardiansService', () => {
  const tx = {
    student: {
      findFirst: vi.fn(),
    },
    guardian: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    studentGuardian: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
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

  let service: GuardiansService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );

    workspaceAccessMock.requireRoles.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });

    tx.student.findFirst.mockResolvedValue({ id: STUDENT_ID });

    service = new GuardiansService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('listForStudent', () => {
    it('requires a staff role, verifies the student and returns the links', async () => {
      const links = [{ id: LINK_ID, isPrimary: true, guardian }];
      tx.studentGuardian.findMany.mockResolvedValue(links);

      const result = await service.listForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID);

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER, WorkspaceRole.TEACHER],
        tx,
      );
      expect(tx.student.findFirst).toHaveBeenCalledWith({
        where: { id: STUDENT_ID, workspaceId: WORKSPACE_ID },
        select: { id: true },
      });
      expect(tx.studentGuardian.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, studentId: STUDENT_ID },
        select: expect.any(Object),
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      });
      expect(result).toEqual({ items: links });
    });

    it('throws when the student is outside the workspace', async () => {
      tx.student.findFirst.mockResolvedValue(null);

      await expect(
        service.listForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.studentGuardian.findMany).not.toHaveBeenCalled();
    });

    it('propagates the access check failure', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(new ForbiddenException());

      await expect(
        service.listForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.studentGuardian.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createForStudent', () => {
    it('makes the first guardian primary and records an audit event', async () => {
      tx.studentGuardian.count.mockResolvedValue(0);
      tx.guardian.create.mockResolvedValue(guardian);
      tx.studentGuardian.create.mockResolvedValue({ id: LINK_ID, isPrimary: true });

      const result = await service.createForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
        firstName: 'Sunil',
        lastName: 'Perera',
        relationship: GuardianRelationship.FATHER,
        email: 'sunil@example.com',
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER],
        tx,
      );
      expect(tx.studentGuardian.updateMany).not.toHaveBeenCalled();
      expect(tx.guardian.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          firstName: 'Sunil',
          lastName: 'Perera',
          relationship: GuardianRelationship.FATHER,
          email: 'sunil@example.com',
          phone: null,
          occupation: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          district: null,
          postalCode: null,
        },
        select: expect.any(Object),
      });
      expect(tx.studentGuardian.create).toHaveBeenCalledWith({
        data: {
          workspaceId: WORKSPACE_ID,
          studentId: STUDENT_ID,
          guardianId: GUARDIAN_ID,
          isPrimary: true,
        },
        select: { id: true, isPrimary: true },
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.GUARDIAN_CREATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: GUARDIAN_ID,
        metadata: { studentId: STUDENT_ID, isPrimary: true },
      });
      expect(result).toEqual({ id: LINK_ID, isPrimary: true, guardian });
    });

    it('adds later guardians as secondary by default', async () => {
      tx.studentGuardian.count.mockResolvedValue(1);
      tx.guardian.create.mockResolvedValue(guardian);
      tx.studentGuardian.create.mockResolvedValue({ id: LINK_ID, isPrimary: false });

      await service.createForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
        firstName: 'Sunil',
        relationship: GuardianRelationship.GUARDIAN,
        isPrimary: false,
      });

      expect(tx.studentGuardian.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isPrimary: false }),
        select: { id: true, isPrimary: true },
      });
    });

    it('demotes the current primary when the new guardian is primary', async () => {
      tx.studentGuardian.count.mockResolvedValue(1);
      tx.guardian.create.mockResolvedValue(guardian);
      tx.studentGuardian.create.mockResolvedValue({ id: LINK_ID, isPrimary: true });

      await service.createForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
        firstName: 'Chamari',
        relationship: GuardianRelationship.MOTHER,
        isPrimary: true,
      });

      expect(tx.studentGuardian.updateMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, studentId: STUDENT_ID, isPrimary: true },
        data: { isPrimary: false },
      });
    });

    it('throws when the student is outside the workspace', async () => {
      tx.student.findFirst.mockResolvedValue(null);

      await expect(
        service.createForStudent(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, {
          firstName: 'Sunil',
          relationship: GuardianRelationship.FATHER,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.guardian.create).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the guardian with their linked students', async () => {
      const linkedStudent = {
        id: STUDENT_ID,
        studentCode: 'STU-001',
        firstName: 'Nimal',
        lastName: 'Perera',
      };
      tx.guardian.findFirst.mockResolvedValue({
        ...guardian,
        students: [{ student: linkedStudent }],
      });

      const result = await service.findOne(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID);

      expect(tx.guardian.findFirst).toHaveBeenCalledWith({
        where: { id: GUARDIAN_ID, workspaceId: WORKSPACE_ID },
        select: expect.any(Object),
      });
      expect(result).toEqual({ ...guardian, linkedStudents: [linkedStudent] });
    });

    it('throws when the guardian does not exist in the workspace', async () => {
      tx.guardian.findFirst.mockResolvedValue(null);

      await expect(service.findOne(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('writes and audits only the changed fields', async () => {
      tx.guardian.findFirst.mockResolvedValue(guardian);
      tx.guardian.update.mockResolvedValue({ ...guardian, occupation: 'Carpenter' });

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID, {
        occupation: 'Carpenter',
        phone: '+94770000002',
      });

      expect(tx.guardian.update).toHaveBeenCalledWith({
        where: { id: GUARDIAN_ID },
        data: { occupation: 'Carpenter' },
        select: expect.any(Object),
      });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.GUARDIAN_UPDATED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: GUARDIAN_ID,
        metadata: { fields: ['occupation'] },
      });
      expect(result.occupation).toBe('Carpenter');
    });

    it('skips the write and the audit event when nothing changes', async () => {
      tx.guardian.findFirst.mockResolvedValue(guardian);

      const result = await service.update(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID, {
        firstName: 'Sunil',
        relationship: GuardianRelationship.FATHER,
      });

      expect(tx.guardian.update).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
      expect(result).toEqual(guardian);
    });

    it('treats blank optional values as null', async () => {
      tx.guardian.findFirst.mockResolvedValue(guardian);
      tx.guardian.update.mockResolvedValue({ ...guardian, occupation: null });

      await service.update(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID, { occupation: '' });

      expect(tx.guardian.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { occupation: null } }),
      );
    });

    it('rejects an empty update before touching the database', async () => {
      await expect(service.update(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(workspaceAccessMock.requireRoles).not.toHaveBeenCalled();
    });

    it('throws when the guardian does not exist in the workspace', async () => {
      tx.guardian.findFirst.mockResolvedValue(null);

      await expect(
        service.update(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID, { city: 'Kandy' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.guardian.update).not.toHaveBeenCalled();
    });
  });

  describe('unlink', () => {
    it('removes the link and records an audit event', async () => {
      tx.studentGuardian.findFirst.mockResolvedValue({ id: LINK_ID });

      await service.unlink(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, GUARDIAN_ID);

      expect(tx.studentGuardian.findFirst).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, studentId: STUDENT_ID, guardianId: GUARDIAN_ID },
        select: { id: true },
      });
      expect(tx.studentGuardian.delete).toHaveBeenCalledWith({ where: { id: LINK_ID } });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.GUARDIAN_UNLINKED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: GUARDIAN_ID,
        metadata: { studentId: STUDENT_ID },
      });
    });

    it('throws when the guardian is not linked to the student', async () => {
      tx.studentGuardian.findFirst.mockResolvedValue(null);

      await expect(
        service.unlink(ACTOR_ID, WORKSPACE_ID, STUDENT_ID, GUARDIAN_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.studentGuardian.delete).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an unlinked guardian and records an audit event', async () => {
      tx.guardian.findFirst.mockResolvedValue({ id: GUARDIAN_ID });
      tx.studentGuardian.count.mockResolvedValue(0);

      await service.remove(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID);

      expect(tx.guardian.delete).toHaveBeenCalledWith({ where: { id: GUARDIAN_ID } });
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.GUARDIAN_DELETED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        targetId: GUARDIAN_ID,
      });
    });

    it('refuses to delete a guardian that is still linked', async () => {
      tx.guardian.findFirst.mockResolvedValue({ id: GUARDIAN_ID });
      tx.studentGuardian.count.mockResolvedValue(1);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(tx.guardian.delete).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('throws when the guardian does not exist in the workspace', async () => {
      tx.guardian.findFirst.mockResolvedValue(null);

      await expect(service.remove(ACTOR_ID, WORKSPACE_ID, GUARDIAN_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tx.studentGuardian.count).not.toHaveBeenCalled();
    });
  });
});
