export const instant = false;

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Library, PlusCircle } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassListResponse } from '@/lib/classes';
import { formatDate } from '@/lib/format-date';
import {
  LESSON_STATUSES,
  lessonStatusClasses,
  lessonStatusLabels,
  type LessonHubResponse,
  type LessonStatus,
} from '@/lib/lessons';
import { canViewStudents, getWorkspaceSession } from '@/lib/workspace-session';

type LearningPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 20;

function isLessonStatus(value: string): value is LessonStatus {
  return (LESSON_STATUSES as readonly string[]).includes(value);
}

function filtersHref(
  workspaceId: string,
  filters: { classId?: string; status?: LessonStatus; page?: number },
): string {
  const search = new URLSearchParams();

  if (filters.classId) {
    search.set('classId', filters.classId);
  }

  if (filters.status) {
    search.set('status', filters.status);
  }

  if (filters.page && filters.page > 1) {
    search.set('page', String(filters.page));
  }

  const query = search.toString();

  return `/workspaces/${workspaceId}/learning${query ? `?${query}` : ''}`;
}

export default async function LearningPage({ params, searchParams }: LearningPageProps) {
  const { workspaceId } = await params;
  const queryParams = await searchParams;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Learning"
        studentsHref={`/workspaces/${workspaceId}/students`}
      >
        <WorkspaceAccessNotice />
      </DashboardShell>
    );
  }

  if (!canViewStudents(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Learning"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="Learning is restricted"
          message="Only owners, administrators, branch managers and teachers can view lessons."
        />
      </DashboardShell>
    );
  }

  const currentWorkspace = workspace;
  const classesResponse = await fetch(
    `${apiUrl}/workspaces/${currentWorkspace.id}/classes?pageSize=100`,
    { headers, cache: 'no-store' },
  );

  if (!classesResponse.ok) {
    throw new Error('Unable to load the class list.');
  }

  const classes = (await classesResponse.json()) as ClassListResponse;

  const requestedClassId =
    typeof queryParams.classId === 'string' ? queryParams.classId.trim() : '';
  const selectedClassId = classes.items.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : undefined;

  const requestedStatus =
    typeof queryParams.status === 'string' ? queryParams.status.trim() : '';
  const selectedStatus = isLessonStatus(requestedStatus) ? requestedStatus : undefined;

  const requestedPage = Number(
    typeof queryParams.page === 'string' ? queryParams.page.trim() : '',
  );
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const lessonSearch = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });

  if (selectedClassId) {
    lessonSearch.set('classId', selectedClassId);
  }

  if (selectedStatus) {
    lessonSearch.set('status', selectedStatus);
  }

  const lessonsResponse = await fetch(
    `${apiUrl}/workspaces/${currentWorkspace.id}/lessons?${lessonSearch.toString()}`,
    { headers, cache: 'no-store' },
  );

  if (!lessonsResponse.ok) {
    throw new Error('Unable to load the lesson list.');
  }

  const lessons = (await lessonsResponse.json()) as LessonHubResponse;
  const hasFilters = Boolean(selectedClassId || selectedStatus);
  const firstItem = lessons.total === 0 ? 0 : (lessons.page - 1) * lessons.pageSize + 1;
  const lastItem = Math.min(lessons.page * lessons.pageSize, lessons.total);

  return (
    <DashboardShell
      user={user}
      activePage="Learning"
      studentsHref={`/workspaces/${currentWorkspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href="/workspaces"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to workspaces
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">Learning management</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Learning
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Lessons and materials for every class in {currentWorkspace.name}. Open a class to create or
          edit its lessons.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Class</span>
            <select
              name="classId"
              defaultValue={selectedClassId ?? ''}
              className="min-w-44 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All classes</option>
              {classes.items.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                  {schoolClass.status === 'ARCHIVED' ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Status</span>
            <select
              name="status"
              defaultValue={selectedStatus ?? ''}
              className="min-w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              {LESSON_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {lessonStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Apply filters
          </button>

          {hasFilters ? (
            <Link
              href={filtersHref(currentWorkspace.id, {})}
              className="pb-1.5 text-xs font-medium text-slate-500 transition hover:text-blue-600"
            >
              Clear
            </Link>
          ) : null}
        </form>

        <p className="text-xs text-slate-500">
          {lessons.total === 0
            ? 'No lessons found'
            : `Showing ${firstItem}–${lastItem} of ${lessons.total}`}
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Lessons</h2>
          <p className="mt-1 text-sm text-slate-500">
            Newest lesson date first across all classes in this workspace.
          </p>
        </div>

        {lessons.items.length === 0 ? (
          <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <Library size={30} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              {hasFilters ? 'No lessons match these filters' : 'No lessons yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {hasFilters
                ? 'Try another class or status.'
                : 'Open a class and add its first lesson with materials.'}
            </p>
            <Link
              href={
                hasFilters
                  ? filtersHref(currentWorkspace.id, {})
                  : `/workspaces/${currentWorkspace.id}/classes`
              }
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {hasFilters ? null : <PlusCircle size={16} />}
              {hasFilters ? 'Clear filters' : 'Go to classes'}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3">Lesson</th>
                    <th className="px-3 py-3">Class</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Materials</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {lessons.items.map((lesson) => (
                    <tr
                      key={lesson.id}
                      className="border-t border-slate-100 align-top transition hover:bg-slate-50"
                    >
                      <td className="px-3 py-4">
                        <Link
                          href={`/workspaces/${currentWorkspace.id}/classes/${lesson.classId}/lessons/${lesson.id}`}
                          className="font-semibold text-slate-900 transition hover:text-blue-700"
                        >
                          {lesson.title}
                        </Link>
                        {lesson.subject ? (
                          <p className="mt-0.5 text-xs text-slate-500">{lesson.subject.name}</p>
                        ) : null}
                      </td>

                      <td className="px-3 py-4">
                        <Link
                          href={`/workspaces/${currentWorkspace.id}/classes/${lesson.classId}`}
                          className="text-slate-700 transition hover:text-blue-700"
                        >
                          {lesson.class.name}
                        </Link>
                        {lesson.class.status === 'ARCHIVED' ? (
                          <p className="mt-0.5 text-xs text-slate-400">Archived</p>
                        ) : null}
                      </td>

                      <td className="px-3 py-4 whitespace-nowrap text-slate-700">
                        {formatDate(lesson.lessonDate)}
                      </td>

                      <td className="px-3 py-4 text-slate-700">
                        {lesson.materialCount === 0
                          ? 'None'
                          : `${lesson.materialCount} ${lesson.materialCount === 1 ? 'material' : 'materials'}`}
                      </td>

                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${lessonStatusClasses[lesson.status]}`}
                        >
                          {lessonStatusLabels[lesson.status]}
                        </span>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {lesson.createdBy ? `by ${lesson.createdBy.name}` : 'Author removed'}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lessons.totalPages > 1 ? (
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Page {lessons.page} of {lessons.totalPages}
                </p>

                <div className="flex items-center gap-2">
                  {lessons.page > 1 ? (
                    <Link
                      href={filtersHref(currentWorkspace.id, {
                        classId: selectedClassId,
                        status: selectedStatus,
                        page: lessons.page - 1,
                      })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </Link>
                  ) : null}

                  {lessons.page < lessons.totalPages ? (
                    <Link
                      href={filtersHref(currentWorkspace.id, {
                        classId: selectedClassId,
                        status: selectedStatus,
                        page: lessons.page + 1,
                      })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Next
                      <ChevronRight size={14} />
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </DashboardShell>
  );
}
