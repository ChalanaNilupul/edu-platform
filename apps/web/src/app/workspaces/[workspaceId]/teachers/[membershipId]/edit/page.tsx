export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { TeacherProfileForm } from '@/components/teacher-profile-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { teacherName, type TeacherRecord } from '@/lib/teachers';
import { canManageTeachers, canViewTeachers, getWorkspaceSession } from '@/lib/workspace-session';

type EditTeacherPageProps = {
  params: Promise<{ workspaceId: string; membershipId: string }>;
};

export default async function EditTeacherPage({ params }: EditTeacherPageProps) {
  const { workspaceId, membershipId } = await params;
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
          message="Only owners, administrators, branch managers and teachers can view teacher profiles."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${workspace.id}/teachers/${membershipId}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Teachers"
        studentsHref={`/workspaces/${workspace.id}/students`}
        teachersHref={`/workspaces/${workspace.id}/teachers`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Teacher not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This person may no longer be a member of the workspace, or the link is incorrect.
          </p>
          <Link
            href={`/workspaces/${workspace.id}/teachers`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to teachers
          </Link>
        </section>
      </DashboardShell>
    );
  }

  if (!response.ok) {
    throw new Error('Unable to load the teacher profile.');
  }

  const teacher = (await response.json()) as TeacherRecord;
  const canEdit = canManageTeachers(workspace.role) || user.id === teacher.user.id;

  if (!canEdit) {
    return (
      <DashboardShell
        user={user}
        activePage="Teachers"
        studentsHref={`/workspaces/${workspace.id}/students`}
        teachersHref={`/workspaces/${workspace.id}/teachers`}
      >
        <WorkspaceAccessNotice
          title="You have read-only access"
          message="Only owners, administrators, branch managers and the teacher themselves can edit this profile."
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={user}
      activePage="Teachers"
      studentsHref={`/workspaces/${workspace.id}/students`}
      teachersHref={`/workspaces/${workspace.id}/teachers`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/teachers/${teacher.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to profile
        </Link>

        <p className="mt-4 text-sm font-medium text-blue-600">{workspace.name}</p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {teacher.teacherProfile ? 'Edit profile' : 'Add profile'}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Update {teacherName(teacher)}’s teaching details. Membership and role changes are handled
          elsewhere.
        </p>
      </div>

      <TeacherProfileForm
        workspaceId={workspace.id}
        membershipId={teacher.id}
        teacherName={teacherName(teacher)}
        initial={teacher.teacherProfile}
      />
    </DashboardShell>
  );
}
