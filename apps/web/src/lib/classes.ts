import type { MembershipStatus, WorkspaceRole } from './teachers';

export const CLASS_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export type ClassStatus = (typeof CLASS_STATUSES)[number];

export const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'WITHDRAWN'] as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export type ClassRecord = {
  id: string;
  name: string;
  grade: string | null;
  description: string | null;
  capacity: number | null;
  status: ClassStatus;
  createdAt: string;
  updatedAt: string;
  enrolledCount: number;
};

export type ClassListResponse = {
  items: ClassRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type EnrollmentRecord = {
  id: string;
  studentId: string;
  classId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    studentCode: string | null;
    firstName: string;
    lastName: string | null;
  };
  class: {
    id: string;
    name: string;
    grade: string | null;
    status: ClassStatus;
    capacity: number | null;
  };
};

export type EnrollmentListResponse = {
  items: EnrollmentRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ClassTeacherAssignment = {
  id: string;
  classId: string;
  membershipId: string;
  isPrimary: boolean;
  assignedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  class: {
    id: string;
    name: string;
    grade: string | null;
    status: ClassStatus;
  };
  membership: {
    id: string;
    role: WorkspaceRole;
    status: MembershipStatus;
    user: {
      id: string;
      firstName: string;
      lastName: string | null;
      email: string;
    };
    teacherProfile: { specializations: string[] } | null;
  };
};

export type ClassTeacherListResponse = {
  items: ClassTeacherAssignment[];
  past: ClassTeacherAssignment[];
};

export const classStatusLabels: Record<ClassStatus, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const classStatusClasses: Record<ClassStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

export const enrollmentStatusLabels: Record<EnrollmentStatus, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
};

export const enrollmentStatusClasses: Record<EnrollmentStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-blue-50 text-blue-700',
  WITHDRAWN: 'bg-amber-50 text-amber-700',
};

export function classCapacityLabel(schoolClass: Pick<ClassRecord, 'capacity' | 'enrolledCount'>) {
  return schoolClass.capacity === null
    ? `${schoolClass.enrolledCount} enrolled`
    : `${schoolClass.enrolledCount} / ${schoolClass.capacity} enrolled`;
}
