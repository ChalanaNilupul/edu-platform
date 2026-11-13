import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import { AuditEventType, StudentStatus, WorkspaceRole } from '../generated/prisma/client.js';
import type { TenantContextService } from '../prisma/tenant-context.service.js';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { StudentsImportService } from './students-import.service.js';

const WORKSPACE_ID = 'workspace-123';
const ACTOR_ID = 'actor-123';

describe('StudentsImportService', () => {
  const tx = {
    student: {
      findMany: vi.fn(),
      createMany: vi.fn(),
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

  let service: StudentsImportService;

  beforeEach(() => {
    vi.resetAllMocks();

    tenantMock.runAsTenant.mockImplementation(
      async (_workspaceId: string, callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    workspaceAccessMock.requireRoles.mockResolvedValue({
      id: 'membership-123',
      role: WorkspaceRole.ADMIN,
    });
    tx.student.findMany.mockResolvedValue([]);
    tx.student.createMany.mockResolvedValue({ count: 0 });

    service = new StudentsImportService(
      tenantMock as unknown as TenantContextService,
      workspaceAccessMock as unknown as WorkspaceAccessService,
      auditMock as unknown as AuditService,
    );
  });

  describe('validate', () => {
    it('requires a managing role and reports valid rows', async () => {
      const result = await service.validate(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,last_name\nNimal,Perera\n',
      });

      expect(workspaceAccessMock.requireRoles).toHaveBeenCalledWith(
        ACTOR_ID,
        WORKSPACE_ID,
        [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER],
        tx,
      );
      expect(result).toEqual({
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        duplicateRows: 0,
        rows: [
          {
            line: 2,
            studentCode: null,
            firstName: 'Nimal',
            status: 'VALID',
            errors: [],
          },
        ],
      });
      expect(tx.student.createMany).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('reports every validation problem on a row with its spreadsheet line', async () => {
      const result = await service.validate(ACTOR_ID, WORKSPACE_ID, {
        csv: [
          'first_name,email,date_of_birth,gender,status',
          ',not-an-email,14-05-2010,BOY,ARCHIVED',
          'Kamal',
        ].join('\n'),
      });

      expect(result.totalRows).toBe(2);
      expect(result.invalidRows).toBe(2);

      const [first, second] = result.rows;
      const firstErrors = first?.errors.join(' | ') ?? '';

      expect(first?.status).toBe('INVALID');
      expect(firstErrors).toContain('firstName');
      expect(firstErrors).toContain('email must be an email');
      expect(firstErrors).toContain('dateOfBirth must be an ISO date');
      expect(firstErrors).toContain('gender must be one of the following values');
      expect(firstErrors).toContain('status must be one of the following values');

      expect(second?.errors).toEqual(['Expected 5 columns but found 1']);
    });

    it('treats blank optional cells as absent', async () => {
      const result = await service.validate(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,last_name,email,date_of_birth,status\nNimal,,,,\n',
      });

      expect(result.rows[0]?.status).toBe('VALID');
      expect(result.rows[0]?.errors).toEqual([]);
      expect(tx.student.findMany).not.toHaveBeenCalled();
    });

    it('flags duplicate student codes inside the file and only checks valid codes against the database', async () => {
      const result = await service.validate(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,student_code\nNimal,STU-1\nKamal,STU-1\nSunil,STU-1\n',
      });

      expect(result.validRows).toBe(1);
      expect(result.duplicateRows).toBe(2);
      expect(result.rows[1]).toMatchObject({
        line: 3,
        studentCode: 'STU-1',
        status: 'DUPLICATE',
      });
      expect(result.rows[1]?.errors[0]).toContain('already appears on line 2');
      expect(result.rows[2]?.errors[0]).toContain('already appears on line 2');
      expect(tx.student.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, studentCode: { in: ['STU-1'] } },
        select: { studentCode: true },
      });
    });

    it('flags codes that already exist in the workspace as duplicates', async () => {
      tx.student.findMany.mockResolvedValue([{ studentCode: 'STU-1' }]);

      const result = await service.validate(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,student_code\nNimal,STU-1\nKamal,STU-2\n',
      });

      expect(tx.student.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, studentCode: { in: ['STU-1', 'STU-2'] } },
        select: { studentCode: true },
      });
      expect(result.validRows).toBe(1);
      expect(result.duplicateRows).toBe(1);
      expect(result.rows[0]).toMatchObject({ studentCode: 'STU-1', status: 'DUPLICATE' });
      expect(result.rows[0]?.errors[0]).toContain('already exists in this workspace');
      expect(result.rows[1]?.status).toBe('VALID');
    });

    it('skips the duplicate lookup when no row has a student code', async () => {
      await service.validate(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name\nNimal\nKamal\n',
      });

      expect(tx.student.findMany).not.toHaveBeenCalled();
    });

    it('rejects unsupported columns and lists the supported ones', async () => {
      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: 'first_name,nickname\nNimal,Nim\n' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: 'first_name,nickname\nNimal,Nim\n' }),
      ).rejects.toThrow('Unsupported column: nickname');
    });

    it('requires first_name and at least one data row', async () => {
      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: 'last_name\nPerera\n' }),
      ).rejects.toThrow('The header row must include a first_name column');
      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: 'first_name\n' }),
      ).rejects.toThrow('The CSV has a header row but no student rows');
    });

    it('rejects files over the row limit before validating rows', async () => {
      const rows = Array.from({ length: 2001 }, (_, index) => `Student ${index}`).join('\n');

      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: `first_name\n${rows}\n` }),
      ).rejects.toThrow('the limit is 2,000');
    });

    it('rejects oversized payloads', async () => {
      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: 'x'.repeat(1_000_001) }),
      ).rejects.toThrow('The CSV is larger than 1,000,000 characters');
    });

    it('propagates role rejections without touching students', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(new ForbiddenException());

      await expect(
        service.validate(ACTOR_ID, WORKSPACE_ID, { csv: 'first_name\nNimal\n' }),
      ).rejects.toThrow(ForbiddenException);
      expect(tx.student.findMany).not.toHaveBeenCalled();
    });
  });

  describe('import', () => {
    it('creates valid rows, skips duplicates and records a single audit event', async () => {
      tx.student.createMany.mockResolvedValue({ count: 2 });

      const result = await service.import(ACTOR_ID, WORKSPACE_ID, {
        csv: [
          'first_name,last_name,student_code,date_of_birth,gender',
          'Nimal,Perera,STU-1,2010-05-14,MALE',
          'Nimal,Perera,STU-1,2010-05-14,MALE',
          'Sunil,,,,',
        ].join('\n'),
      });

      expect(result).toEqual({
        imported: 2,
        skipped: 1,
        duplicates: [{ line: 3, studentCode: 'STU-1', reason: 'IN_FILE' }],
      });

      expect(tx.student.createMany).toHaveBeenCalledWith({
        data: [
          {
            workspaceId: WORKSPACE_ID,
            studentCode: 'STU-1',
            firstName: 'Nimal',
            lastName: 'Perera',
            dateOfBirth: new Date('2010-05-14'),
            gender: 'MALE',
            email: null,
            phone: null,
            addressLine1: null,
            addressLine2: null,
            city: null,
            district: null,
            postalCode: null,
            school: null,
            grade: null,
            status: 'ACTIVE',
          },
          {
            workspaceId: WORKSPACE_ID,
            studentCode: null,
            firstName: 'Sunil',
            lastName: null,
            dateOfBirth: null,
            gender: null,
            email: null,
            phone: null,
            addressLine1: null,
            addressLine2: null,
            city: null,
            district: null,
            postalCode: null,
            school: null,
            grade: null,
            status: 'ACTIVE',
          },
        ],
        skipDuplicates: true,
      });

      expect(auditMock.record).toHaveBeenCalledTimes(1);
      expect(auditMock.record).toHaveBeenCalledWith({
        type: AuditEventType.STUDENTS_IMPORTED,
        actorUserId: ACTOR_ID,
        workspaceId: WORKSPACE_ID,
        metadata: { imported: 2, skipped: 1 },
      });
    });

    it('skips codes that already exist without updating them', async () => {
      tx.student.findMany.mockResolvedValue([{ studentCode: 'STU-2' }]);
      tx.student.createMany.mockResolvedValue({ count: 1 });

      const result = await service.import(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,student_code\nNimal,STU-1\nKamal,STU-2\n',
      });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.duplicates).toEqual([{ line: 3, studentCode: 'STU-2', reason: 'EXISTING' }]);

      const payload = tx.student.createMany.mock.calls[0]?.[0] as {
        data: { studentCode: string | null }[];
      };

      expect(payload.data.map((row) => row.studentCode)).toEqual(['STU-1']);
    });

    it('refuses the whole file when any row is invalid', async () => {
      const csv = 'first_name,email\nNimal,not-an-email\nKamal,kamal@example.com\n';

      await expect(service.import(ACTOR_ID, WORKSPACE_ID, { csv })).rejects.toThrow(
        'Fix 1 invalid row before importing',
      );
      await expect(service.import(ACTOR_ID, WORKSPACE_ID, { csv })).rejects.toMatchObject({
        response: {
          invalidRows: [{ line: 2, status: 'INVALID', studentCode: null, firstName: 'Nimal' }],
        },
      });

      expect(tx.student.createMany).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });

    it('does not call createMany when every row is a duplicate', async () => {
      tx.student.findMany.mockResolvedValue([{ studentCode: 'STU-1' }]);

      const result = await service.import(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,student_code\nNimal,STU-1\n',
      });

      expect(result).toEqual({
        imported: 0,
        skipped: 1,
        duplicates: [{ line: 2, studentCode: 'STU-1', reason: 'EXISTING' }],
      });
      expect(tx.student.createMany).not.toHaveBeenCalled();
      expect(auditMock.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { imported: 0, skipped: 1 } }),
      );
    });

    it('keeps explicit statuses and trims cell values', async () => {
      tx.student.createMany.mockResolvedValue({ count: 1 });

      await service.import(ACTOR_ID, WORKSPACE_ID, {
        csv: 'first_name,status,grade\n  Nimal  ,  GRADUATED  , Grade 9\n',
      });

      const payload = tx.student.createMany.mock.calls[0]?.[0] as {
        data: { firstName: string; status: StudentStatus; grade: string | null }[];
      };

      expect(payload.data[0]).toMatchObject({
        firstName: 'Nimal',
        status: StudentStatus.GRADUATED,
        grade: 'Grade 9',
      });
    });

    it('propagates role rejections before writing anything', async () => {
      workspaceAccessMock.requireRoles.mockRejectedValue(new ForbiddenException());

      await expect(
        service.import(ACTOR_ID, WORKSPACE_ID, { csv: 'first_name\nNimal\n' }),
      ).rejects.toThrow(ForbiddenException);
      expect(tx.student.createMany).not.toHaveBeenCalled();
      expect(auditMock.record).not.toHaveBeenCalled();
    });
  });
});
