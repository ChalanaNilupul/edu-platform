export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { GuardianForm } from '@/components/guardian-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { StudentRecord } from '@/lib/student';
import { canManageStudents, canViewStudents, getWorkspaceSession } from '@/lib/workspace-session';

type NewGuardianPageProps = {
  params: Promise<{ workspaceId: string; studentId: string }>;
};

export default async function NewGuardianPage({ params }: NewGuardianPageProps) {
  const { workspaceId, studentId } = await params;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Students"
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
        activePage="Students"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="Student records are restricted"
          message="Only owners, administrators, branch managers and teachers can access this workspace's students."
        />
      </DashboardShell>
    );
  }

  if (!canManageStudents(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Students"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="You have read-only access"
          message="Only owners, administrators and branch managers can add guardians."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${workspace.id}/students/${studentId}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Students"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Student not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This student may have been removed or the link is incorrect.
          </p>
          <Link
            href={`/workspaces/${workspace.id}/students`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to students
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (!response.ok) {
    throw new Error('Unable to load the student.');
  }

  const student = (await response.json()) as StudentRecord;

  return (
    <DashboardShell
      user={user}
      activePage="Students"
      studentsHref={`/workspaces/${workspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/students/${student.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to student
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Add guardian
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Link a parent or guardian to {student.firstName}. The first guardian becomes the primary
          contact.
        </p>
      </div>

      <GuardianForm workspaceId={workspace.id} studentId={student.id} />
    </DashboardShell>
  );
}
