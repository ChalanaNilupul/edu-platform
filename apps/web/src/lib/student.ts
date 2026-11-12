export const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'GRADUATED', 'WITHDRAWN'] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export type StudentGender = 'MALE' | 'FEMALE' | 'OTHER';

export type StudentRecord = {
  id: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: StudentGender | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  school: string | null;
  grade: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
};

export type StudentListResponse = {
  items: StudentRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const studentStatusLabels: Record<StudentStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  GRADUATED: 'Graduated',
  WITHDRAWN: 'Withdrawn',
};

export const studentStatusClasses: Record<StudentStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  GRADUATED: 'bg-blue-50 text-blue-700',
  WITHDRAWN: 'bg-amber-50 text-amber-700',
};

export const genderLabels: Record<StudentGender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

export function studentFullName(student: Pick<StudentRecord, 'firstName' | 'lastName'>) {
  return [student.firstName, student.lastName].filter(Boolean).join(' ');
}
