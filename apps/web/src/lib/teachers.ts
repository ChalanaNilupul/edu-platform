export type MembershipStatus = 'ACTIVE' | 'SUSPENDED';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'BRANCH_MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type TeacherProfile = {
  id: string;
  phone: string | null;
  qualifications: string | null;
  specializations: string[];
  bio: string | null;
  joinedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type TeacherRecord = {
  id: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
  };
  teacherProfile: TeacherProfile | null;
};

export type TeacherListResponse = {
  items: TeacherRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;

export const membershipStatusLabels: Record<MembershipStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
};

export const membershipStatusClasses: Record<MembershipStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-amber-50 text-amber-700',
};

export const roleLabels: Record<WorkspaceRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  BRANCH_MANAGER: 'Branch manager',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

export function teacherName(teacher: Pick<TeacherRecord, 'user'>) {
  return [teacher.user.firstName, teacher.user.lastName].filter(Boolean).join(' ');
}

export function teacherInitials(teacher: Pick<TeacherRecord, 'user'>) {
  return `${teacher.user.firstName[0] ?? ''}${teacher.user.lastName?.[0] ?? ''}`.toUpperCase();
}
