export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ClassForm } from '@/components/class-form';
import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { canManageClasses, canViewClasses, getWorkspaceSession } from '@/lib/workspace-session';

type NewClassPageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function NewClassPage({ params }: NewClassPageProps) {
  const { workspaceId } = await params;
  const { user, workspace } = await getWorkspaceSession(workspaceId);

  if (!workspace) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${workspaceId}/students`}
        classesHref={`/workspaces/${workspaceId}/classes`}
      >
        <WorkspaceAccessNotice />
      </DashboardShell>
    );
  }

  if (!canViewClasses(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${workspace.id}/students`}
        classesHref={`/workspaces/${workspace.id}/classes`}
      >
        <WorkspaceAccessNotice
          title="Classes are restricted"
          message="Only owners, administrators, branch managers and teachers can access this workspace's classes."
        />
      </DashboardShell>
    );
  }

  if (!canManageClasses(workspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${workspace.id}/students`}
        classesHref={`/workspaces/${workspace.id}/classes`}
      >
        <WorkspaceAccessNotice
          title="You have read-only access"
          message="Only owners, administrators and branch managers can create classes."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      activePage="Classes"
      studentsHref={`/workspaces/${workspace.id}/students`}
      classesHref={`/workspaces/${workspace.id}/classes`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/classes`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to classes
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          New class
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Give the class a name, then enroll students from its detail page.
        </p>
      </div>

      <ClassForm workspaceId={workspace.id} />
    </DashboardShell>
  );
}
