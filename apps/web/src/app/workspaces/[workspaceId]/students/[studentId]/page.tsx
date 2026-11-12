export const instant = false;

import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { formatDate } from '@/lib/format-date';
import {
  genderLabels,
  studentFullName,
  studentStatusClasses,
  studentStatusLabels,
  type StudentRecord,
} from '@/lib/student';
import { canManageStudents, canViewStudents, getWorkspaceSession } from '@/lib/workspace-session';

type StudentPageProps = {
  params: Promise<{ workspaceId: string; studentId: string }>;
};

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}

export default async function StudentDetailPage({ params }: StudentPageProps) {
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
          message="Only owners, administrators, branch managers and teachers can view this workspace's students."
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
  const canManage = canManageStudents(workspace.role);
  const address = [
    student.addressLine1,
    student.addressLine2,
    student.city,
    student.district,
    student.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

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

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {studentFullName(student)}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${studentStatusClasses[student.status]}`}
              >
                {studentStatusLabels[student.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {student.studentCode ? `Student code ${student.studentCode}` : 'No student code'} ·{' '}
              {workspace.name}
            </p>
          </div>

          {canManage ? (
            <Link
              href={`/workspaces/${workspace.id}/students/${student.id}/edit`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Pencil size={16} />
              Edit student
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Personal</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Detail
              label="Date of birth"
              value={student.dateOfBirth ? formatDate(student.dateOfBirth) : null}
            />
            <Detail label="Gender" value={student.gender ? genderLabels[student.gender] : null} />
            <Detail label="Grade" value={student.grade} />
            <Detail label="School" value={student.school} />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Contact</h2>
          <dl className="mt-5 grid gap-4">
            <Detail label="Phone" value={student.phone} />
            <Detail label="Email" value={student.email} />
            <Detail label="Address" value={address} />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Record</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Detail label="Created" value={formatDate(student.createdAt)} />
            <Detail label="Last updated" value={formatDate(student.updatedAt)} />
          </dl>
        </section>
      </div>
    </DashboardShell>
  );
}
