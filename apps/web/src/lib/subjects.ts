export const SUBJECT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export type SubjectStatus = (typeof SUBJECT_STATUSES)[number];

export type SubjectRecord = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: SubjectStatus;
  createdAt: string;
  updatedAt: string;
  classCount: number;
};

export type SubjectListResponse = {
  items: SubjectRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ClassSubjectListResponse = {
  items: SubjectRecord[];
};

export const subjectStatusLabels: Record<SubjectStatus, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
};

export const subjectStatusClasses: Record<SubjectStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};
