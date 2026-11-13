export const GUARDIAN_RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'] as const;

export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export type GuardianRecord = {
  id: string;
  firstName: string;
  lastName: string | null;
  relationship: GuardianRelationship;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentGuardianLink = {
  id: string;
  isPrimary: boolean;
  guardian: GuardianRecord;
};

export type GuardianListResponse = {
  items: StudentGuardianLink[];
};

export type LinkedStudent = {
  id: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
};

export type GuardianDetail = GuardianRecord & {
  linkedStudents: LinkedStudent[];
};

export const guardianRelationshipLabels: Record<GuardianRelationship, string> = {
  FATHER: 'Father',
  MOTHER: 'Mother',
  GUARDIAN: 'Guardian',
  OTHER: 'Other',
};

export function guardianFullName(guardian: Pick<GuardianRecord, 'firstName' | 'lastName'>): string {
  return [guardian.firstName, guardian.lastName].filter(Boolean).join(' ');
}

export function guardianAddress(guardian: GuardianRecord): string {
  return [
    guardian.addressLine1,
    guardian.addressLine2,
    guardian.city,
    guardian.district,
    guardian.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
}
