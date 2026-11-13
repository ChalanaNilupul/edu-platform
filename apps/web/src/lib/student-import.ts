export const IMPORT_REQUIRED_COLUMN = 'first_name';

export const IMPORT_SUPPORTED_COLUMNS = [
  'student_code',
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'district',
  'postal_code',
  'school',
  'grade',
  'status',
] as const;

export const IMPORT_MAX_ROWS = 2_000;
export const IMPORT_MAX_FILE_BYTES = 1_000_000;

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

export const importRowStatusLabels: Record<ImportRowStatus, string> = {
  VALID: 'Ready',
  INVALID: 'Invalid',
  DUPLICATE: 'Duplicate',
};

export const importRowStatusClasses: Record<ImportRowStatus, string> = {
  VALID: 'bg-emerald-50 text-emerald-700',
  INVALID: 'bg-red-50 text-red-700',
  DUPLICATE: 'bg-amber-50 text-amber-700',
};

export const importDuplicateReasonLabels: Record<ImportDuplicate['reason'], string> = {
  IN_FILE: 'Repeated in the file',
  EXISTING: 'Already exists in this workspace',
};
