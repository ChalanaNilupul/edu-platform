export const instant = false;

import Link from 'next/link';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { GuardianActions } from '@/components/guardian-actions';
import { StudentAttendanceSummary } from '@/components/student-attendance-summary';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import { lastNDays, todayInColombo, type StudentAttendanceSummaryResponse } from '@/lib/attendance';
import {
  enrollmentStatusClasses,
  enrollmentStatusLabels,
  type EnrollmentRecord,
} from '@/lib/classes';
import { formatDate } from '@/lib/format-date';
import {
  guardianFullName,
  guardianRelationshipLabels,
  type GuardianListResponse,
} from '@/lib/guardian';
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

  const guardiansResponse = await fetch(
    `${apiUrl}/workspaces/${workspace.id}/students/${studentId}/guardians`,
    { headers, cache: 'no-store' },
  );

  if (!guardiansResponse.ok) {
    throw new Error('Unable to load the student guardians.');
  }

  const { items: guardianLinks } = (await guardiansResponse.json()) as GuardianListResponse;

  const enrollmentsResponse = await fetch(
    `${apiUrl}/workspaces/${workspace.id}/students/${studentId}/enrollments`,
    { headers, cache: 'no-store' },
  );

  if (!enrollmentsResponse.ok) {
    throw new Error('Unable to load the student classes.');
  }

  const enrollments = (await enrollmentsResponse.json()) as EnrollmentRecord[];

  const attendanceToday = todayInColombo();
  const summaryRange = lastNDays(attendanceToday, 30);
  const summaryResponse = await fetch(
    `${apiUrl}/workspaces/${workspace.id}/students/${studentId}/attendance/summary?from=${summaryRange.from}&to=${summaryRange.to}`,
    { headers, cache: 'no-store' },
  );

  if (!summaryResponse.ok) {
    throw new Error('Unable to load the student attendance summary.');
  }

  const initialSummary = (await summaryResponse.json()) as StudentAttendanceSummaryResponse;

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Guardians</h2>
              <p className="mt-1 text-sm text-slate-500">
                Parents and guardians linked to {student.firstName}.
              </p>
            </div>

            {canManage ? (
              <Link
                href={`/workspaces/${workspace.id}/students/${student.id}/guardians/new`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Plus size={16} />
                Add guardian
              </Link>
            ) : null}
          </div>

          {guardianLinks.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No guardians linked yet.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {guardianLinks.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {guardianFullName(link.guardian)}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {guardianRelationshipLabels[link.guardian.relationship]}
                      </span>
                      {link.isPrimary ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {[link.guardian.phone, link.guardian.email, link.guardian.occupation]
                        .filter(Boolean)
                        .join(' · ') || 'No contact details yet'}
                    </p>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/workspaces/${workspace.id}/students/${student.id}/guardians/${link.guardian.id}/edit`}
                        className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                      >
                        Edit
                      </Link>
                      <GuardianActions
                        workspaceId={workspace.id}
                        studentId={student.id}
                        guardianId={link.guardian.id}
                        guardianName={guardianFullName(link.guardian)}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Classes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enrollment history for {student.firstName}.
              </p>
            </div>

            <Link
              href={`/workspaces/${workspace.id}/classes`}
              className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Manage classes
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              Not enrolled in any class yet.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-slate-100">
              {enrollments.map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/workspaces/${workspace.id}/classes/${enrollment.class.id}`}
                        className="text-sm font-semibold text-slate-900 transition hover:text-blue-600"
                      >
                        {enrollment.class.name}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enrollmentStatusClasses[enrollment.status]}`}
                      >
                        {enrollmentStatusLabels[enrollment.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Enrolled {formatDate(enrollment.enrolledAt)}
                      {enrollment.endedAt ? ` · Ended ${formatDate(enrollment.endedAt)}` : ''}
                    </p>
                  </div>

                  <p className="text-xs text-slate-500">
                    {enrollment.class.grade ?? 'No grade set'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Attendance summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                Attendance rate across {student.firstName}&apos;s classes.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              Last 30 days by default
            </span>
          </div>

          <div className="mt-4">
            <StudentAttendanceSummary
              workspaceId={workspace.id}
              studentId={student.id}
              studentName={student.firstName}
              today={attendanceToday}
              initial={initialSummary}
            />
          </div>
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
