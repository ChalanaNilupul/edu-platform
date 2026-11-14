export const instant = false;

import Link from 'next/link';
import { ArrowLeft, BookMarked, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  SUBJECT_STATUSES,
  subjectStatusClasses,
  subjectStatusLabels,
  type SubjectListResponse,
  type SubjectStatus,
} from '@/lib/subjects';
import { canManageSubjects, canViewSubjects, getWorkspaceSession } from '@/lib/workspace-session';

const PAGE_SIZE = 20;

type SubjectsPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseStatus(value: string | string[] | undefined): SubjectStatus | '' {
  return typeof value === 'string' && (SUBJECT_STATUSES as readonly string[]).includes(value)
    ? (value as SubjectStatus)
    : '';
}

export default async function SubjectsPage({ params, searchParams }: SubjectsPageProps) {
  const { workspaceId } = await params;
  const queryParams = await searchParams;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Subjects"
        studentsHref={`/workspaces/${workspaceId}/students`}
      >
        <WorkspaceAccessNotice />
      </DashboardShell>
    );
  }

  if (!canViewSubjects(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Subjects"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="Subjects are restricted"
          message="Only owners, administrators, branch managers and teachers can view this workspace's subjects."
        />
      </DashboardShell>
    );
  }

  const currentWorkspace = workspace;
  const search = typeof queryParams.search === 'string' ? queryParams.search.trim() : '';
  const status = parseStatus(queryParams.status);
  const rawPage = typeof queryParams.page === 'string' ? Number(queryParams.page) : 1;
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const canManage = canManageSubjects(currentWorkspace.role);

  const apiParams = new URLSearchParams();

  if (search) {
    apiParams.set('search', search);
  }

  if (status) {
    apiParams.set('status', status);
  }

  apiParams.set('page', String(page));
  apiParams.set('pageSize', String(PAGE_SIZE));

  const response = await fetch(
    `${apiUrl}/workspaces/${currentWorkspace.id}/subjects?${apiParams.toString()}`,
    { headers, cache: 'no-store' },
  );

  if (!response.ok) {
    throw new Error('Unable to load the subjects.');
  }

  const data = (await response.json()) as SubjectListResponse;

  function directoryHref(targetPage: number) {
    const next = new URLSearchParams();

    if (search) {
      next.set('search', search);
    }

    if (status) {
      next.set('status', status);
    }

    if (targetPage > 1) {
      next.set('page', String(targetPage));
    }

    const suffix = next.toString();

    return `/workspaces/${currentWorkspace.id}/subjects${suffix ? `?${suffix}` : ''}`;
  }

  const firstItem = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const lastItem = Math.min(data.page * data.pageSize, data.total);
  const hasPrevious = data.page > 1;
  const hasNext = data.page < data.totalPages;

  return (
    <DashboardShell
      user={user}
      activePage="Subjects"
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

        <p className="mt-4 text-sm font-medium text-blue-600">Subject management</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Subjects
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Subjects for {currentWorkspace.name}. Attach them to classes from the class page.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search subject name, code or description"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
              />
            </div>

            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              {SUBJECT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {subjectStatusLabels[option]}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Apply
            </button>
          </form>

          {canManage ? (
            <Link
              href={`/workspaces/${currentWorkspace.id}/subjects/new`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={16} />
              New subject
            </Link>
          ) : null}
        </div>

        {data.items.length === 0 ? (
          <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <BookMarked size={34} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No subjects found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || status
                ? 'Try a different search or clear the filters.'
                : 'Create the first subject so classes can be linked to it.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Classes</th>
                  <th className="px-3 py-3">Status</th>
                  {canManage ? <th className="px-3 py-3">Actions</th> : null}
                </tr>
              </thead>

              <tbody>
                {data.items.map((subject) => (
                  <tr
                    key={subject.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-4">
                      <p className="font-semibold text-slate-900">{subject.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {subject.code ?? 'No code set'}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {subject.classCount === 1 ? '1 class' : `${subject.classCount} classes`}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${subjectStatusClasses[subject.status]}`}
                      >
                        {subjectStatusLabels[subject.status]}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-4">
                        <Link
                          href={`/workspaces/${currentWorkspace.id}/subjects/${subject.id}/edit`}
                          className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                          Edit
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {firstItem}–{lastItem} of {data.total}
          </p>

          <div className="flex items-center gap-2">
            {hasPrevious ? (
              <Link
                href={directoryHref(data.page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-2 text-slate-300">
                <ChevronLeft size={16} />
                Previous
              </span>
            )}

            <span className="px-2 text-xs font-medium text-slate-500">
              Page {data.page} of {Math.max(data.totalPages, 1)}
            </span>

            {hasNext ? (
              <Link
                href={directoryHref(data.page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Next
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-2 text-slate-300">
                Next
                <ChevronRight size={16} />
              </span>
            )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
