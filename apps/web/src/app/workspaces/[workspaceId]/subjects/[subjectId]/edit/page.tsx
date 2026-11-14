export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { SubjectForm } from '@/components/subject-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { SubjectRecord } from '@/lib/subjects';
import { canManageSubjects, canViewSubjects, getWorkspaceSession } from '@/lib/workspace-session';

type EditSubjectPageProps = {
  params: Promise<{ workspaceId: string; subjectId: string }>;
};

export default async function EditSubjectPage({ params }: EditSubjectPageProps) {
  const { workspaceId, subjectId } = await params;
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
          message="Only owners, administrators and branch managers can edit subjects."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${workspace.id}/subjects/${subjectId}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Subjects"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Subject not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This subject may have been deleted or the link is incorrect.
          </p>
          <Link
            href={`/workspaces/${workspace.id}/subjects`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to subjects
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (!response.ok) {
    throw new Error('Unable to load the subject.');
  }

  const subject = (await response.json()) as SubjectRecord;

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
          Edit {subject.name}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Archived subjects stay linked to their classes but are hidden from pickers.
        </p>
      </div>

      <SubjectForm workspaceId={workspace.id} initial={subject} />
    </DashboardShell>
  );
}
