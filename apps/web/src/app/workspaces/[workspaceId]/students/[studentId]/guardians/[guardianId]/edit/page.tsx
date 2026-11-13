export const instant = false;

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { GuardianForm } from '@/components/guardian-form';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { GuardianDetail } from '@/lib/guardian';
import type { StudentRecord } from '@/lib/student';
import { canManageStudents, canViewStudents, getWorkspaceSession } from '@/lib/workspace-session';

type EditGuardianPageProps = {
  params: Promise<{ workspaceId: string; studentId: string; guardianId: string }>;
};

export default async function EditGuardianPage({ params }: EditGuardianPageProps) {
  const { workspaceId, studentId, guardianId } = await params;
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
          message="Only owners, administrators and branch managers can edit guardians."
        />
      </DashboardShell>
    );
  }

  const [studentResponse, guardianResponse] = await Promise.all([
    fetch(`${apiUrl}/workspaces/${workspace.id}/students/${studentId}`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/workspaces/${workspace.id}/guardians/${guardianId}`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  if (studentResponse.status === 404 || guardianResponse.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Students"
        studentsHref={`/workspaces/${workspace.id}/students`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">
            {guardianResponse.status === 404 ? 'Guardian not found' : 'Student not found'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This record may have been removed or the link is incorrect.
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

  if (!studentResponse.ok || !guardianResponse.ok) {
    throw new Error('Unable to load the guardian.');
  }

  const student = (await studentResponse.json()) as StudentRecord;
  const guardian = (await guardianResponse.json()) as GuardianDetail;

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
          Edit guardian
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Update {guardian.firstName}&apos;s details. The record is linked to{' '}
          {guardian.linkedStudents.length === 1
            ? guardian.linkedStudents[0]?.firstName
            : `${guardian.linkedStudents.length} students`}
          .
        </p>
      </div>

      <GuardianForm workspaceId={workspace.id} studentId={student.id} initial={guardian} />
    </DashboardShell>
  );
}
