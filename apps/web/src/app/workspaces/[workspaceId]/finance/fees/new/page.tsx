export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { StudentFeeForm } from '@/components/student-fee-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassListResponse } from '@/lib/classes';
import type { StudentListResponse } from '@/lib/student';
import { canManageFinance, getWorkspaceSession } from '@/lib/workspace-session';

type NewStudentFeePageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function NewStudentFeePage({ params }: NewStudentFeePageProps) {
  const { workspaceId } = await params;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspaceId}/students`}
      >
        <WorkspaceAccessNotice />
      </DashboardShell>
    );
  }

  if (!canManageFinance(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Finance"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="Finance is restricted"
          message="Only owners, administrators and branch managers can create fee records."
        />
      </DashboardShell>
    );
  }

  const [studentsResponse, classesResponse] = await Promise.all([
    fetch(`${apiUrl}/workspaces/${workspace.id}/students?status=ACTIVE&pageSize=100`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/workspaces/${workspace.id}/classes?pageSize=100`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  if (!studentsResponse.ok || !classesResponse.ok) {
    throw new Error('Unable to load the student directory.');
  }

  const students = (await studentsResponse.json()) as StudentListResponse;
  const classes = (await classesResponse.json()) as ClassListResponse;

  return (
    <DashboardShell
      user={user}
      activePage="Finance"
      studentsHref={`/workspaces/${workspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/finance`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to finance
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          New fee record
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Manual records are for one-off charges outside the monthly plans.
        </p>
      </div>

      {students.items.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">No active students yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Add or reactivate a student before creating a fee record.
          </p>
          <Link
            href={`/workspaces/${workspace.id}/students/new`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Add a student
          </Link>
        </section>
      ) : (
        <>
          {students.total > students.items.length ? (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Showing the first {students.items.length} of {students.total} active students. Use the
              student directory if the student is not listed.
            </p>
          ) : null}

          <StudentFeeForm
            workspaceId={workspace.id}
            currency={workspace.currency}
            students={students.items}
            classes={classes.items}
          />
        </>
      )}
    </DashboardShell>
  );
}
