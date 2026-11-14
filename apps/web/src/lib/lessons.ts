import type { ClassStatus } from './classes';

export const LESSON_STATUSES = ['DRAFT', 'PUBLISHED'] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const MATERIAL_KINDS = ['PDF', 'VIDEO', 'LINK'] as const;

export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export type LessonAuthor = {
  membershipId: string;
  name: string;
};

export type LessonRecord = {
  id: string;
  classId: string;
  subjectId: string | null;
  title: string;
  description: string | null;
  lessonDate: string;
  status: LessonStatus;
  createdAt: string;
  updatedAt: string;
  subject: { id: string; name: string } | null;
  createdBy: LessonAuthor | null;
  materialCount: number;
};

export type LessonMaterialRecord = {
  id: string;
  lessonId: string;
  title: string;
  kind: MaterialKind;
  url: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LessonDetailRecord = LessonRecord & {
  class: { id: string; name: string; status: ClassStatus };
  materials: LessonMaterialRecord[];
};

export type LessonListResponse = {
  items: LessonRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type LessonHubRecord = LessonRecord & {
  class: { id: string; name: string; status: ClassStatus };
};

export type LessonHubResponse = {
  items: LessonHubRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const lessonStatusLabels: Record<LessonStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
};

export const lessonStatusClasses: Record<LessonStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
};

export const materialKindLabels: Record<MaterialKind, string> = {
  PDF: 'PDF',
  VIDEO: 'Video',
  LINK: 'Link',
};

export const materialKindClasses: Record<MaterialKind, string> = {
  PDF: 'bg-red-50 text-red-700',
  VIDEO: 'bg-violet-50 text-violet-700',
  LINK: 'bg-blue-50 text-blue-700',
};
