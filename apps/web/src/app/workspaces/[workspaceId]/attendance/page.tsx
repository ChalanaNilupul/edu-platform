export const instant = false;

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ClipboardCheck, Clock3, PlusCircle } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  isCalendarDate,
  todayInColombo,
  type AttendanceOverviewResponse,
  type AttendanceOverviewRow,
} from '@/lib/attendance';
import { canViewStudents, getWorkspaceSession } from '@/lib/workspace-session';

type AttendancePageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Colombo',
});

function dayLabel(date: string): string {
  return DAY_FORMATTER.format(new Date(`${date}T00:00:00.000Z`));
}

function savedAtLabel(value: string): string {
  return `${TIME_FORMATTER.format(new Date(value))} (Colombo time)`;
}

function markChips(row: AttendanceOverviewRow) {
  if (!row.counts) {
    return [];
  }

  return [
    { label: 'Present', count: row.counts.present, className: 'bg-emerald-50 text-emerald-700' },
    { label: 'Absent', count: row.counts.absent, className: 'bg-red-50 text-red-700' },
    { label: 'Late', count: row.counts.late, className: 'bg-amber-50 text-amber-700' },
    { label: 'Excused', count: row.counts.excused, className: 'bg-blue-50 text-blue-700' },
    { label: 'Unmarked', count: row.counts.unmarked, className: 'bg-slate-100 text-slate-600' },
  ];
}

export default async function AttendancePage({ params, searchParams }: AttendancePageProps) {
  const { workspaceId } = await params;
  const queryParams = await searchParams;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Attendance"
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
        activePage="Attendance"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="Attendance is restricted"
          message="Only owners, administrators, branch managers and teachers can view class registers."
        />
      </DashboardShell>
    );
  }

  const currentWorkspace = workspace;
  const today = todayInColombo();
  const requestedDate = typeof queryParams.date === 'string' ? queryParams.date.trim() : '';
  const date = isCalendarDate(requestedDate) && requestedDate <= today ? requestedDate : today;

  const response = await fetch(
    `${apiUrl}/workspaces/${currentWorkspace.id}/attendance/overview?date=${date}`,
    { headers, cache: 'no-store' },
  );

  if (!response.ok) {
    throw new Error('Unable to load the attendance overview.');
  }

  const overview = (await response.json()) as AttendanceOverviewResponse;
  const isToday = date === today;

  return (
    <DashboardShell
      user={user}
      activePage="Attendance"
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

        <p className="mt-4 text-sm font-medium text-blue-600">Attendance management</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Attendance
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Daily registers for the active classes in {currentWorkspace.name}. Open a class to mark or
          correct its register.
        </p>
      </div>

      <section className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Active classes</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <ClipboardCheck size={20} />
            </div>
          </div>

          <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            {overview.totals.classes}
          </p>
          <p className="mt-2 text-xs text-slate-500">Classes that run a daily register</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Registers saved</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            {overview.totals.saved}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {overview.totals.classes - overview.totals.saved === 0
              ? 'Every class has a register for this day'
              : `${overview.totals.missing} still to mark`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Not started</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock3 size={20} />
            </div>
          </div>

          <p className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            {overview.totals.missing}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {isToday ? 'Classes without a register today' : 'Classes without a register that day'}
          </p>
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {dayLabel(date)}
          {isToday ? <span className="ml-2 text-xs font-medium text-blue-600">Today</span> : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {isToday ? null : (
            <Link
              href={`/workspaces/${currentWorkspace.id}/attendance`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Jump to today
            </Link>
          )}

          <form method="get" className="flex items-center gap-2">
            <label htmlFor="attendance-date" className="text-xs font-medium text-slate-500">
              Register date
            </label>
            <input
              id="attendance-date"
              type="date"
              name="date"
              defaultValue={date}
              max={today}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Show day
            </button>
          </form>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Class registers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Present, absent, late, excused and unmarked counts for the selected day.
          </p>
        </div>

        {overview.classes.length === 0 ? (
          <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <ClipboardCheck size={30} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No active classes</p>
            <p className="mt-1 text-xs text-slate-500">
              Create a class and enroll students to start recording attendance.
            </p>
            <Link
              href={`/workspaces/${currentWorkspace.id}/classes`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              <PlusCircle size={16} />
              Go to classes
            </Link>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Class</th>
                  <th className="px-3 py-3">Students</th>
                  <th className="px-3 py-3">Register</th>
                  <th className="px-3 py-3">Marks</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {overview.classes.map((row) => (
                  <tr
                    key={row.classId}
                    className="border-t border-slate-100 align-top transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-4">
                      <Link
                        href={`/workspaces/${currentWorkspace.id}/classes/${row.classId}`}
                        className="font-semibold text-slate-900 transition hover:text-blue-700"
                      >
                        {row.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{row.grade ?? 'No grade set'}</p>
                    </td>

                    <td className="px-3 py-4 text-slate-700">
                      {row.enrolledCount === 0
                        ? 'No active students'
                        : `${row.enrolledCount} enrolled`}
                    </td>

                    <td className="px-3 py-4">
                      {row.session ? (
                        <>
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Saved
                          </span>
                          <p className="mt-1.5 text-xs text-slate-600">
                            by {row.session.recordedBy?.name ?? 'a removed member'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Last saved {savedAtLabel(row.session.updatedAt)}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Not started
                          </span>
                          <p className="mt-1.5 text-xs text-slate-500">
                            {row.enrolledCount === 0
                              ? 'No students to mark'
                              : 'Nobody has marked this day yet'}
                          </p>
                        </>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {row.counts ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {markChips(row).map((chip) => (
                            <span
                              key={chip.label}
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${chip.className}`}
                            >
                              {chip.label} {chip.count}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No marks yet</span>
                      )}
                    </td>

                    <td className="px-3 py-4 text-right">
                      <Link
                        href={`/workspaces/${currentWorkspace.id}/classes/${row.classId}?date=${date}#attendance`}
                        className="whitespace-nowrap text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        {row.session ? 'Open register' : 'Mark register'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
