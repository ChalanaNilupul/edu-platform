export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ClassForm } from '@/components/class-form';
import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassRecord } from '@/lib/classes';
import { canManageClasses, canViewClasses, getWorkspaceSession } from '@/lib/workspace-session';

type EditClassPageProps = {
  params: Promise<{ workspaceId: string; classId: string }>;
};

export default async function EditClassPage({ params }: EditClassPageProps) {
  const { workspaceId, classId } = await params;
  const { user, workspace, apiUrl, headers } = await getWorkspaceSession(workspaceId);

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
          message="Only owners, administrators and branch managers can edit classes."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${workspace.id}/classes/${classId}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${workspace.id}/students`}
        classesHref={`/workspaces/${workspace.id}/classes`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Class not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This class may have been deleted or the link is incorrect.
          </p>
          <Link
            href={`/workspaces/${workspace.id}/classes`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to classes
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (!response.ok) {
    throw new Error('Unable to load the class.');
  }

  const schoolClass = (await response.json()) as ClassRecord;

  return (
    <DashboardShell
      user={user}
      activePage="Classes"
      studentsHref={`/workspaces/${workspace.id}/students`}
      classesHref={`/workspaces/${workspace.id}/classes`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/classes/${schoolClass.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to class
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Edit {schoolClass.name}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Update the class details. Existing enrollments are never changed here.
        </p>
      </div>

      <ClassForm workspaceId={workspace.id} initial={schoolClass} />
    </DashboardShell>
  );
}
