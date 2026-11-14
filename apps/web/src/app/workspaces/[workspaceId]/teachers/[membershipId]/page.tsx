export const instant = false;

import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  UserRound,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  classStatusClasses,
  classStatusLabels,
  type ClassTeacherListResponse,
} from '@/lib/classes';
import { formatDate } from '@/lib/format-date';
import {
  membershipStatusClasses,
  membershipStatusLabels,
  roleLabels,
  teacherInitials,
  teacherName,
  type TeacherRecord,
} from '@/lib/teachers';
import { canManageTeachers, canViewTeachers, getWorkspaceSession } from '@/lib/workspace-session';

type TeacherDetailPageProps = {
  params: Promise<{ workspaceId: string; membershipId: string }>;
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{value || 'Not provided'}</p>
    </div>
  );
}

export default async function TeacherDetailPage({ params }: TeacherDetailPageProps) {
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
  const profile = teacher.teacherProfile;
  const canEdit = canManageTeachers(workspace.role) || user.id === teacher.user.id;

  const classesResponse = await fetch(
    `${apiUrl}/workspaces/${workspace.id}/teachers/${teacher.id}/classes`,
    { headers, cache: 'no-store' },
  );

  if (!classesResponse.ok) {
    throw new Error('Unable to load the teacher assignments.');
  }

  const assignedClasses = (await classesResponse.json()) as ClassTeacherListResponse;

  return (
    <DashboardShell
      user={user}
      activePage="Teachers"
      studentsHref={`/workspaces/${workspace.id}/students`}
      teachersHref={`/workspaces/${workspace.id}/teachers`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspace.id}/teachers`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to teachers
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-blue-700">
              {teacherInitials(teacher)}
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {teacherName(teacher)}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{roleLabels[teacher.role]}</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${membershipStatusClasses[teacher.status]}`}
                >
                  {membershipStatusLabels[teacher.status]}
                </span>
              </p>
            </div>
          </div>

          {canEdit ? (
            <Link
              href={`/workspaces/${workspace.id}/teachers/${teacher.id}/edit`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Pencil size={16} />
              {profile ? 'Edit profile' : 'Add profile'}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Contact</h2>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Mail size={16} className="text-slate-400" />
              {teacher.user.email}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Phone size={16} className="text-slate-400" />
              {profile?.phone ?? 'No phone number'}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <CalendarDays size={16} className="text-slate-400" />
              Member since {formatDate(teacher.createdAt)}
            </div>
            {profile?.joinedAt ? (
              <div className="flex items-center gap-3 text-sm text-slate-700">
                <BadgeCheck size={16} className="text-slate-400" />
                Teaching since {formatDate(profile.joinedAt)}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Profile</h2>

          {profile ? (
            <div className="mt-4 space-y-4">
              <Field label="Qualifications" value={profile.qualifications} />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Specializations
                </p>
                {profile.specializations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.specializations.map((specialization) => (
                      <span
                        key={specialization}
                        className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                      >
                        {specialization}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-700">Not provided</p>
                )}
              </div>

              <Field label="Bio" value={profile.bio} />
              <Field label="Notes" value={profile.notes} />
            </div>
          ) : (
            <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
              <UserRound size={30} className="text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">No profile yet</p>
              <p className="mt-1 text-xs text-slate-500">
                {canEdit
                  ? 'Add qualifications, specializations and contact details.'
                  : 'A manager has not added this teacher’s profile yet.'}
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Assigned classes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Classes this teacher is currently running.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {assignedClasses.items.length} current
          </span>
        </div>

        {assignedClasses.items.length === 0 ? (
          <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <BookOpen size={28} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">No current classes</p>
            <p className="mt-1 text-xs text-slate-500">
              Assign this teacher from a class page to see it here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {assignedClasses.items.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/workspaces/${workspace.id}/classes/${assignment.class.id}`}
                      className="font-semibold text-slate-900 transition hover:text-blue-600"
                    >
                      {assignment.class.name}
                    </Link>
                    {assignment.isPrimary ? (
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        Primary
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classStatusClasses[assignment.class.status]}`}
                    >
                      {classStatusLabels[assignment.class.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {assignment.class.grade ?? 'No grade set'} · Assigned{' '}
                    {formatDate(assignment.assignedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {assignedClasses.past.length > 0 ? (
          <details className="mt-5 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Past classes ({assignedClasses.past.length})
            </summary>

            <ul className="mt-3 space-y-2">
              {assignedClasses.past.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/workspaces/${workspace.id}/classes/${assignment.class.id}`}
                    className="font-medium text-slate-800 transition hover:text-blue-600"
                  >
                    {assignment.class.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {formatDate(assignment.assignedAt)} –{' '}
                    {assignment.endedAt ? formatDate(assignment.endedAt) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </DashboardShell>
  );
}
