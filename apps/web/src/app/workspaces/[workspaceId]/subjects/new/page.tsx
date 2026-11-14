export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { SubjectForm } from '@/components/subject-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { canManageSubjects, canViewSubjects, getWorkspaceSession } from '@/lib/workspace-session';

type NewSubjectPageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function NewSubjectPage({ params }: NewSubjectPageProps) {
  const { workspaceId } = await params;
  const { user, workspace } = await getWorkspaceSession(workspaceId);

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
          message="Only owners, administrators, branch managers and teachers can access this workspace's subjects."
        />
      </DashboardShell>
    );
  }

  if (!canManageSubjects(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Subjects"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <WorkspaceAccessNotice
          title="You have read-only access"
          message="Only owners, administrators and branch managers can create subjects."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      activePage="Subjects"
      studentsHref={`/workspaces/${workspace.id}/students`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/subjects`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to subjects
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          New subject
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Add a subject to the workspace catalogue, then attach it to classes.
        </p>
      </div>

      <SubjectForm workspaceId={workspace.id} />
    </DashboardShell>
  );
}
