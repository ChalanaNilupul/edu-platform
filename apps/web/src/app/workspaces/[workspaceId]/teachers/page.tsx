export const instant = false;

import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Search,
  UserRound,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  MEMBERSHIP_STATUSES,
  membershipStatusClasses,
  membershipStatusLabels,
  roleLabels,
  teacherInitials,
  teacherName,
  type MembershipStatus,
  type TeacherListResponse,
} from '@/lib/teachers';
import { canViewTeachers, getWorkspaceSession } from '@/lib/workspace-session';

const PAGE_SIZE = 20;

type TeachersPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseStatus(value: string | string[] | undefined): MembershipStatus | '' {
  return typeof value === 'string' && (MEMBERSHIP_STATUSES as readonly string[]).includes(value)
    ? (value as MembershipStatus)
    : '';
}

export default async function TeachersPage({ params, searchParams }: TeachersPageProps) {
  const { workspaceId } = await params;
  const queryParams = await searchParams;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell user={user} activePage="Teachers">
        <WorkspaceAccessNotice />
      </DashboardShell>
    );
  }

  if (!canViewTeachers(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Teachers"
        studentsHref={`/workspaces/${workspace.id}/students`}
        teachersHref={`/workspaces/${workspace.id}/teachers`}
      >
        <WorkspaceAccessNotice
          title="Teachers are restricted"
          message="Only owners, administrators, branch managers and teachers can view the teacher directory."
        />
      </DashboardShell>
    );
  }

  const currentWorkspace = workspace;
  const search = typeof queryParams.search === 'string' ? queryParams.search.trim() : '';
  const status = parseStatus(queryParams.status);
  const rawPage = typeof queryParams.page === 'string' ? Number(queryParams.page) : 1;
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

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
    `${apiUrl}/workspaces/${currentWorkspace.id}/teachers?${apiParams.toString()}`,
    { headers, cache: 'no-store' },
  );

  if (!response.ok) {
    throw new Error('Unable to load the teacher directory.');
  }

  const data = (await response.json()) as TeacherListResponse;

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

    return `/workspaces/${currentWorkspace.id}/teachers${suffix ? `?${suffix}` : ''}`;
  }

  const firstItem = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const lastItem = Math.min(data.page * data.pageSize, data.total);
  const hasPrevious = data.page > 1;
  const hasNext = data.page < data.totalPages;

  return (
    <DashboardShell
      user={user}
      activePage="Teachers"
      studentsHref={`/workspaces/${currentWorkspace.id}/students`}
      teachersHref={`/workspaces/${currentWorkspace.id}/teachers`}
    >
      <div className="mb-8">
        <Link
          href="/workspaces"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to workspaces
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">Teacher management</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Teachers
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Teachers and other teaching staff for {currentWorkspace.name}. Open a profile to keep
          qualifications and contact details up to date.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
              placeholder="Search name, email or qualification"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
            />
          </div>

          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All statuses</option>
            {MEMBERSHIP_STATUSES.map((option) => (
              <option key={option} value={option}>
                {membershipStatusLabels[option]}
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

        {data.items.length === 0 ? (
          <div className="mt-8 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <GraduationCap size={34} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No teachers found</p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              {search || status
                ? 'Try a different search or clear the filters.'
                : 'Invite staff with the Teacher role from the Members page. They will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Teacher</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Profile</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {data.items.map((teacher) => (
                  <tr
                    key={teacher.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                          {teacherInitials(teacher)}
                        </span>
                        <div>
                          <Link
                            href={`/workspaces/${currentWorkspace.id}/teachers/${teacher.id}`}
                            className="font-semibold text-slate-900 transition hover:text-blue-600"
                          >
                            {teacherName(teacher)}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">{teacher.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-slate-700">{roleLabels[teacher.role]}</td>
                    <td className="px-3 py-4">
                      {teacher.teacherProfile ? (
                        <div>
                          <p className="font-medium text-slate-800">
                            {teacher.teacherProfile.qualifications ?? 'Profile added'}
                          </p>
                          {teacher.teacherProfile.specializations.length > 0 ? (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {teacher.teacherProfile.specializations.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <UserRound size={13} />
                          No profile yet
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${membershipStatusClasses[teacher.status]}`}
                      >
                        {membershipStatusLabels[teacher.status]}
                      </span>
                    </td>
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
