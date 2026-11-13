export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { StudentImport } from '@/components/student-import';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { canManageStudents, canViewStudents, getWorkspaceSession } from '@/lib/workspace-session';

type ImportStudentsPageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function ImportStudentsPage({ params }: ImportStudentsPageProps) {
  const { workspaceId } = await params;
  const { user, workspace } = await getWorkspaceSession(workspaceId);

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
          message="Only owners, administrators and branch managers can import students."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      activePage="Students"
      studentsHref={`/workspaces/${workspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/students`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to students
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Import students
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Upload a CSV file, review every row, then create the valid records in one step. Existing
          student codes are skipped rather than overwritten.
        </p>
      </div>

      <StudentImport workspaceId={workspace.id} />
    </DashboardShell>
  );
}
