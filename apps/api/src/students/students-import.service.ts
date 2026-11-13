import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { plainToInstance, instanceToPlain } from 'class-transformer';
import { validate } from 'class-validator';

import { AuditService } from '../audit/audit.service.js';
import { AuditEventType, WorkspaceRole } from '../generated/prisma/client.js';
import type { Prisma, StudentGender, StudentStatus } from '../generated/prisma/client.js';
import { TenantContextService } from '../prisma/tenant-context.service.js';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service.js';
import { CsvParseError, MAX_IMPORT_CSV_CHARS, MAX_IMPORT_ROWS, parseCsv } from './csv.js';
import type { CsvTable } from './csv.js';
import { ImportStudentRowDto } from './dto/import-students.dto.js';
import type { ImportStudentsDto } from './dto/import-students.dto.js';

const MANAGE_ROLES = [WorkspaceRole.ADMIN, WorkspaceRole.BRANCH_MANAGER];

const COLUMN_TO_FIELD = {
  student_code: 'studentCode',
  first_name: 'firstName',
  last_name: 'lastName',
  date_of_birth: 'dateOfBirth',
  gender: 'gender',
  email: 'email',
  phone: 'phone',
  address_line1: 'addressLine1',
  address_line2: 'addressLine2',
  city: 'city',
  district: 'district',
  postal_code: 'postalCode',
  school: 'school',
  grade: 'grade',
  status: 'status',
} as const;

type ColumnName = keyof typeof COLUMN_TO_FIELD;
type FieldName = (typeof COLUMN_TO_FIELD)[ColumnName];

const SUPPORTED_COLUMNS = Object.keys(COLUMN_TO_FIELD) as ColumnName[];

export type ImportRowStatus = 'VALID' | 'INVALID' | 'DUPLICATE';

export type ImportRowReport = {
  line: number;
  studentCode: string | null;
  firstName: string | null;
  status: ImportRowStatus;
  errors: string[];
};

export type ImportValidationReport = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: ImportRowReport[];
};

export type ImportDuplicate = {
  line: number;
  studentCode: string;
  reason: 'IN_FILE' | 'EXISTING';
};

export type ImportResult = {
  imported: number;
  skipped: number;
  duplicates: ImportDuplicate[];
};

type AnalyzedRow = {
  line: number;
  values: Partial<Record<FieldName, string>>;
  errors: string[];
  status: ImportRowStatus;
  duplicateReason: ImportDuplicate['reason'] | null;
};

async function validateRow(values: Partial<Record<FieldName, string>>): Promise<{
  errors: string[];
  normalized: Partial<Record<FieldName, string>>;
}> {
  const row = plainToInstance(ImportStudentRowDto, values);
  const errors = await validate(row);

  return {
    errors: errors.flatMap((error) => Object.values(error.constraints ?? {})),
    // The DTO transforms trim cells and lower-case emails, so persist that.
    normalized: instanceToPlain(row) as Partial<Record<FieldName, string>>,
  };
}

@Injectable()
export class StudentsImportService {
  constructor(
    @Inject(TenantContextService) private readonly tenant: TenantContextService,
    @Inject(WorkspaceAccessService) private readonly workspaceAccess: WorkspaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async validate(
    actorId: string,
    workspaceId: string,
    dto: ImportStudentsDto,
  ): Promise<ImportValidationReport> {
    return this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const { rows } = await this.analyze(dto.csv);
      await this.markExistingDuplicates(tx, workspaceId, rows);

      return this.toReport(rows);
    });
  }

  async import(
    actorId: string,
    workspaceId: string,
    dto: ImportStudentsDto,
  ): Promise<ImportResult> {
    const result = await this.tenant.runAsTenant(workspaceId, async (tx) => {
      await this.workspaceAccess.requireRoles(actorId, workspaceId, MANAGE_ROLES, tx);

      const { rows } = await this.analyze(dto.csv);

      const invalid = rows.filter((row) => row.status === 'INVALID');

      if (invalid.length > 0) {
        throw new BadRequestException({
          message: `Fix ${invalid.length} invalid row${invalid.length === 1 ? '' : 's'} before importing`,
          invalidRows: invalid.map((row) => this.toRowReport(row)),
        });
      }

      await this.markExistingDuplicates(tx, workspaceId, rows);

      const toCreate = rows.filter((row) => row.status === 'VALID');
      let imported = 0;

      if (toCreate.length > 0) {
        const created = await tx.student.createMany({
          data: toCreate.map((row) => this.buildCreateData(workspaceId, row.values)),
          // A concurrent import may insert the same code after the check above.
          skipDuplicates: true,
        });

        imported = created.count;
      }

      return {
        imported,
        skipped: rows.length - imported,
        duplicates: rows.flatMap((row): ImportDuplicate[] => {
          if (row.status !== 'DUPLICATE' || row.duplicateReason === null) {
            return [];
          }

          return [
            {
              line: row.line,
              studentCode: row.values.studentCode ?? '',
              reason: row.duplicateReason,
            },
          ];
        }),
      };
    });

    await this.audit.record({
      type: AuditEventType.STUDENTS_IMPORTED,
      actorUserId: actorId,
      workspaceId,
      metadata: { imported: result.imported, skipped: result.skipped },
    });

    return result;
  }

  private async analyze(csv: string): Promise<{ rows: AnalyzedRow[] }> {
    if (csv.length > MAX_IMPORT_CSV_CHARS) {
      throw new BadRequestException(
        `The CSV is larger than ${MAX_IMPORT_CSV_CHARS.toLocaleString('en-US')} characters`,
      );
    }

    let table: CsvTable;

    try {
      table = parseCsv(csv);
    } catch (error) {
      if (error instanceof CsvParseError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    const unsupported = table.headers.filter((header) => !(header in COLUMN_TO_FIELD));

    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Unsupported column${unsupported.length === 1 ? '' : 's'}: ${unsupported.join(', ')}. ` +
          `Supported columns are: ${SUPPORTED_COLUMNS.join(', ')}`,
      );
    }

    if (!table.headers.includes('first_name')) {
      throw new BadRequestException('The header row must include a first_name column');
    }

    if (table.records.length === 0) {
      throw new BadRequestException('The CSV has a header row but no student rows');
    }

    if (table.records.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `The CSV contains ${table.records.length} student rows; the limit is ${MAX_IMPORT_ROWS.toLocaleString('en-US')}`,
      );
    }

    const rows: AnalyzedRow[] = [];

    for (const record of table.records) {
      const errors: string[] = [];

      if (record.fields.length !== table.headers.length) {
        errors.push(`Expected ${table.headers.length} columns but found ${record.fields.length}`);
      }

      const values: Partial<Record<FieldName, string>> = {};

      table.headers.forEach((header, index) => {
        const field = (COLUMN_TO_FIELD as Record<string, FieldName | undefined>)[header];

        if (!field) {
          return;
        }

        const raw = (record.fields[index] ?? '').trim();

        // Blank optional cells are treated as absent, empty first_name is not.
        if (raw.length > 0 || field === 'firstName') {
          values[field] = raw;
        }
      });

      const { errors: rowErrors, normalized } = await validateRow(values);

      errors.push(...rowErrors);

      rows.push({
        line: record.line,
        values: normalized,
        errors,
        status: errors.length > 0 ? 'INVALID' : 'VALID',
        duplicateReason: null,
      });
    }

    this.markFileDuplicates(rows);

    return { rows };
  }

  private markFileDuplicates(rows: AnalyzedRow[]): void {
    const firstSeen = new Map<string, number>();

    for (const row of rows) {
      if (row.status !== 'VALID') {
        continue;
      }

      const code = row.values.studentCode;

      if (!code) {
        continue;
      }

      const previousLine = firstSeen.get(code);

      if (previousLine !== undefined) {
        row.status = 'DUPLICATE';
        row.duplicateReason = 'IN_FILE';
        row.errors.push(
          `Duplicate student code "${code}" in this file; it already appears on line ${previousLine}`,
        );
        continue;
      }

      firstSeen.set(code, row.line);
    }
  }

  private async markExistingDuplicates(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    rows: AnalyzedRow[],
  ): Promise<void> {
    const codes = [
      ...new Set(
        rows.flatMap((row) => {
          if (row.status !== 'VALID' || !row.values.studentCode) {
            return [];
          }

          return [row.values.studentCode];
        }),
      ),
    ];

    if (codes.length === 0) {
      return;
    }

    const existing = await tx.student.findMany({
      where: { workspaceId, studentCode: { in: codes } },
      select: { studentCode: true },
    });

    const taken = new Set(existing.map((student) => student.studentCode));

    for (const row of rows) {
      const code = row.values.studentCode;

      if (row.status !== 'VALID' || !code || !taken.has(code)) {
        continue;
      }

      row.status = 'DUPLICATE';
      row.duplicateReason = 'EXISTING';
      row.errors.push(
        `Student code "${code}" already exists in this workspace; existing students are not changed`,
      );
    }
  }

  private buildCreateData(
    workspaceId: string,
    values: Partial<Record<FieldName, string>>,
  ): Prisma.StudentCreateManyInput {
    const text = (field: FieldName): string | null => {
      const value = values[field]?.trim();

      return value && value.length > 0 ? value : null;
    };

    const dateOfBirth = text('dateOfBirth');

    return {
      workspaceId,
      studentCode: text('studentCode'),
      firstName: text('firstName') ?? '',
      lastName: text('lastName'),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: text('gender') as StudentGender | null,
      email: text('email'),
      phone: text('phone'),
      addressLine1: text('addressLine1'),
      addressLine2: text('addressLine2'),
      city: text('city'),
      district: text('district'),
      postalCode: text('postalCode'),
      school: text('school'),
      grade: text('grade'),
      status: (text('status') ?? 'ACTIVE') as StudentStatus,
    };
  }

  private toRowReport(row: AnalyzedRow): ImportRowReport {
    return {
      line: row.line,
      studentCode: row.values.studentCode ?? null,
      firstName:
        row.values.firstName && row.values.firstName.length > 0 ? row.values.firstName : null,
      status: row.status,
      errors: row.errors,
    };
  }

  private toReport(rows: AnalyzedRow[]): ImportValidationReport {
    const count = (status: ImportRowStatus) => rows.filter((row) => row.status === status).length;

    return {
      totalRows: rows.length,
      validRows: count('VALID'),
      invalidRows: count('INVALID'),
      duplicateRows: count('DUPLICATE'),
      rows: rows.map((row) => this.toRowReport(row)),
    };
  }
}
