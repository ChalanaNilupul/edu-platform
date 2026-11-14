export const instant = false;

import Link from 'next/link';
import {
  ArrowLeft,
  BookMarked,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Pencil,
  Search,
  Users,
} from 'lucide-react';

import { AssignTeacherForm } from '@/components/assign-teacher-form';
import { AttendanceManager } from '@/components/attendance-manager';
import { ClassActions } from '@/components/class-actions';
import { ClassAttendanceSummary } from '@/components/class-attendance-summary';
import { ClassSubjectForm } from '@/components/class-subject-form';
import { ClassScheduleManager } from '@/components/class-schedule-manager';
import { ClassTeacherActions } from '@/components/class-teacher-actions';
import { DashboardShell } from '@/components/dashboard-shell';
import { EnrollStudentForm } from '@/components/enroll-student-form';
import { EnrollmentActions } from '@/components/enrollment-actions';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import {
  isCalendarDate,
  lastNDays,
  todayInColombo,
  type AttendanceRegisterResponse,
  type ClassAttendanceSummaryResponse,
} from '@/lib/attendance';
import {
  ENROLLMENT_STATUSES,
  classCapacityLabel,
  classStatusClasses,
  classStatusLabels,
  enrollmentStatusClasses,
  enrollmentStatusLabels,
  type ClassRecord,
  type ClassTeacherListResponse,
  type EnrollmentListResponse,
  type EnrollmentStatus,
} from '@/lib/classes';
import { formatDate } from '@/lib/format-date';
import type { ClassScheduleListResponse } from '@/lib/schedule';
import { studentFullName } from '@/lib/student';
import {
  subjectStatusClasses,
  subjectStatusLabels,
  type ClassSubjectListResponse,
  type SubjectListResponse,
  type SubjectRecord,
} from '@/lib/subjects';
import { roleLabels, teacherName, type TeacherListResponse } from '@/lib/teachers';
import { canManageClasses, canViewClasses, getWorkspaceSession } from '@/lib/workspace-session';

const PAGE_SIZE = 20;
const LOOKUP_PAGE_SIZE = 100;

type ClassDetailPageProps = {
  params: Promise<{ workspaceId: string; classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseStatus(value: string | string[] | undefined): EnrollmentStatus | '' {
  return typeof value === 'string' && (ENROLLMENT_STATUSES as readonly string[]).includes(value)
    ? (value as EnrollmentStatus)
    : '';
}

export default async function ClassDetailPage({ params, searchParams }: ClassDetailPageProps) {
  const { workspaceId, classId } = await params;
  const queryParams = await searchParams;
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
          message="Only owners, administrators, branch managers and teachers can view this workspace's classes."
        />
      </DashboardShell>
    );
  }

  const currentWorkspace = workspace;

  const response = await fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/classes/${classId}`, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 404) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${currentWorkspace.id}/students`}
        classesHref={`/workspaces/${currentWorkspace.id}/classes`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-lg font-bold text-slate-900">Class not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This class may have been deleted or the link is incorrect.
          </p>
          <Link
            href={`/workspaces/${currentWorkspace.id}/classes`}
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

  const search = typeof queryParams.search === 'string' ? queryParams.search.trim() : '';
  const status = parseStatus(queryParams.status);
  const rawPage = typeof queryParams.page === 'string' ? Number(queryParams.page) : 1;
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const canManage = canManageClasses(currentWorkspace.role);
  const today = todayInColombo();
  const requestedDate = typeof queryParams.date === 'string' ? queryParams.date.trim() : '';
  const attendanceDate =
    isCalendarDate(requestedDate) && requestedDate <= today ? requestedDate : today;
  const summaryRange = lastNDays(today, 30);

  const rosterParams = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });

  if (search) {
    rosterParams.set('search', search);
  }

  if (status) {
    rosterParams.set('status', status);
  }

  const [
    rosterResponse,
    activeResponse,
    teachersResponse,
    teacherDirectoryResponse,
    classSubjectsResponse,
    subjectDirectoryResponse,
    scheduleResponse,
    attendanceResponse,
    summaryResponse,
  ] = await Promise.all([
    fetch(
      `${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/enrollments?${rosterParams.toString()}`,
      { headers, cache: 'no-store' },
    ),
    canManage && schoolClass.status === 'ACTIVE'
      ? fetch(
          `${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/enrollments?status=ACTIVE&pageSize=${LOOKUP_PAGE_SIZE}`,
          { headers, cache: 'no-store' },
        )
      : null,
    fetch(
      `${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/teachers${
        canManage ? '?includeEnded=true' : ''
      }`,
      { headers, cache: 'no-store' },
    ),
    canManage && schoolClass.status === 'ACTIVE'
      ? fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/teachers?pageSize=${LOOKUP_PAGE_SIZE}`, {
          headers,
          cache: 'no-store',
        })
      : null,
    fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/subjects`, {
      headers,
      cache: 'no-store',
    }),
    canManage && schoolClass.status === 'ACTIVE'
      ? fetch(
          `${apiUrl}/workspaces/${currentWorkspace.id}/subjects?status=ACTIVE&pageSize=${LOOKUP_PAGE_SIZE}`,
          { headers, cache: 'no-store' },
        )
      : null,
    fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/schedule`, {
      headers,
      cache: 'no-store',
    }),
    fetch(
      `${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/attendance?date=${attendanceDate}`,
      { headers, cache: 'no-store' },
    ),
    fetch(
      `${apiUrl}/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/attendance/summary?from=${summaryRange.from}&to=${summaryRange.to}`,
      { headers, cache: 'no-store' },
    ),
  ]);

  if (!rosterResponse.ok) {
    throw new Error('Unable to load the class roster.');
  }

  if (!teachersResponse.ok) {
    throw new Error('Unable to load the class teachers.');
  }

  if (!classSubjectsResponse.ok) {
    throw new Error('Unable to load the class subjects.');
  }

  if (!scheduleResponse.ok) {
    throw new Error('Unable to load the class timetable.');
  }

  if (!attendanceResponse.ok) {
    throw new Error('Unable to load the attendance register.');
  }

  if (!summaryResponse.ok) {
    throw new Error('Unable to load the attendance summary.');
  }

  const roster = (await rosterResponse.json()) as EnrollmentListResponse;
  const enrolledStudentIds =
    activeResponse && activeResponse.ok
      ? ((await activeResponse.json()) as EnrollmentListResponse).items.map((row) => row.studentId)
      : [];
  const classTeachers = (await teachersResponse.json()) as ClassTeacherListResponse;
  const teacherDirectory =
    teacherDirectoryResponse && teacherDirectoryResponse.ok
      ? ((await teacherDirectoryResponse.json()) as TeacherListResponse).items
      : [];
  const classSubjects = (await classSubjectsResponse.json()) as ClassSubjectListResponse;
  const schedule = (await scheduleResponse.json()) as ClassScheduleListResponse;
  const initialAttendance = (await attendanceResponse.json()) as AttendanceRegisterResponse;
  const initialSummary = (await summaryResponse.json()) as ClassAttendanceSummaryResponse;
  const subjectCatalogue =
    subjectDirectoryResponse && subjectDirectoryResponse.ok
      ? ((await subjectDirectoryResponse.json()) as SubjectListResponse).items
      : [];

  const subjectPicker: SubjectRecord[] = [...subjectCatalogue];

  for (const subject of classSubjects.items) {
    if (!subjectPicker.some((row) => row.id === subject.id)) {
      subjectPicker.push(subject);
    }
  }

  subjectPicker.sort((left, right) => left.name.localeCompare(right.name));

  const isAssignedTeacher = classTeachers.items.some(
    (assignment) => assignment.membership.user.id === user.id,
  );
  const canEditAttendance = (canManage || isAssignedTeacher) && schoolClass.status === 'ACTIVE';
  const attendanceReadOnlyReason =
    schoolClass.status === 'ACTIVE'
      ? canEditAttendance
        ? undefined
        : "Only managers and this class's teachers can change the register."
      : 'This class is archived. Attendance is read-only.';

  function rosterHref(targetPage: number) {
    const next = new URLSearchParams();

    if (search) {
      next.set('search', search);
    }

    if (status) {
      next.set('status', status);
    }

    if (targetPage > 1) {
      next.set('page', String(targetPage));
    }

    const suffix = next.toString();

    return `/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}${
      suffix ? `?${suffix}` : ''
    }`;
  }

  const firstItem = roster.total === 0 ? 0 : (roster.page - 1) * roster.pageSize + 1;
  const lastItem = Math.min(roster.page * roster.pageSize, roster.total);
  const hasPrevious = roster.page > 1;
  const hasNext = roster.page < roster.totalPages;

  return (
    <DashboardShell
      user={user}
      activePage="Classes"
      studentsHref={`/workspaces/${currentWorkspace.id}/students`}
      classesHref={`/workspaces/${currentWorkspace.id}/classes`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${currentWorkspace.id}/classes`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to classes
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {schoolClass.name}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classStatusClasses[schoolClass.status]}`}
              >
                {classStatusLabels[schoolClass.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {schoolClass.grade ?? 'No grade set'} · {classCapacityLabel(schoolClass)} ·{' '}
              {currentWorkspace.name}
            </p>
          </div>

          {canManage ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <ClassActions
                workspaceId={currentWorkspace.id}
                classId={schoolClass.id}
                className={schoolClass.name}
                status={schoolClass.status}
                enrolledCount={schoolClass.enrolledCount}
              />

              <Link
                href={`/workspaces/${currentWorkspace.id}/classes/${schoolClass.id}/edit`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <Pencil size={16} />
                Edit class
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {schoolClass.description ? (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">About this class</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
            {schoolClass.description}
          </p>
        </section>
      ) : null}

      {canManage ? (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Enroll a student</h2>

          {schoolClass.status === 'ACTIVE' ? (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Search the student directory and add the student to this class.
              </p>
              <div className="mt-4">
                <EnrollStudentForm
                  workspaceId={currentWorkspace.id}
                  classId={schoolClass.id}
                  enrolledStudentIds={enrolledStudentIds}
                />
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              This class is archived. Reactivate it to enroll new students.
            </p>
          )}
        </section>
      ) : null}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Teachers</h2>
            <p className="mt-1 text-sm text-slate-500">Staff currently assigned to this class.</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {classTeachers.items.length} assigned
          </span>
        </div>

        {classTeachers.items.length === 0 ? (
          <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <GraduationCap size={28} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">No teachers assigned yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {canManage
                ? 'Assign the teacher who runs this class.'
                : 'A manager has not assigned a teacher to this class yet.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Teacher</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Assigned</th>
                  {canManage ? <th className="px-3 py-3">Actions</th> : null}
                </tr>
              </thead>

              <tbody>
                {classTeachers.items.map((assignment) => (
                  <tr key={assignment.id} className="border-t border-slate-100">
                    <td className="px-3 py-4">
                      <Link
                        href={`/workspaces/${currentWorkspace.id}/teachers/${assignment.membership.id}`}
                        className="font-semibold text-slate-900 transition hover:text-blue-600"
                      >
                        {teacherName(assignment.membership)}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {assignment.membership.user.email}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-slate-700">
                        {roleLabels[assignment.membership.role]}
                      </span>
                      {assignment.isPrimary ? (
                        <span className="ml-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Primary
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 text-slate-700">
                      {formatDate(assignment.assignedAt)}
                    </td>
                    {canManage ? (
                      <td className="px-3 py-4">
                        <ClassTeacherActions
                          workspaceId={currentWorkspace.id}
                          classId={schoolClass.id}
                          assignmentId={assignment.id}
                          teacherName={teacherName(assignment.membership)}
                          isPrimary={assignment.isPrimary}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          schoolClass.status === 'ACTIVE' ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Assign a teacher</h3>
              <div className="mt-3">
                <AssignTeacherForm
                  workspaceId={currentWorkspace.id}
                  classId={schoolClass.id}
                  teachers={teacherDirectory}
                  assignedMembershipIds={classTeachers.items.map((row) => row.membershipId)}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              This class is archived. Reactivate it to assign new teachers.
            </p>
          )
        ) : null}

        {canManage && classTeachers.past.length > 0 ? (
          <details className="mt-6 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Past teachers ({classTeachers.past.length})
            </summary>

            <ul className="mt-3 space-y-2">
              {classTeachers.past.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/workspaces/${currentWorkspace.id}/teachers/${assignment.membership.id}`}
                    className="font-medium text-slate-800 transition hover:text-blue-600"
                  >
                    {teacherName(assignment.membership)}
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

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Subjects</h2>
            <p className="mt-1 text-sm text-slate-500">Subjects this class covers.</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {classSubjects.items.length} linked
          </span>
        </div>

        {classSubjects.items.length === 0 ? (
          <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <BookMarked size={28} className="text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">No subjects linked yet</p>
            <p className="mt-1 text-xs text-slate-500">
              {canManage
                ? 'Link the subjects this class covers.'
                : 'A manager has not linked any subjects to this class yet.'}
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {classSubjects.items.map((subject) => (
              <li
                key={subject.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
              >
                <span className="font-medium text-slate-800">{subject.name}</span>
                {subject.code ? (
                  <span className="text-xs font-semibold text-slate-500">{subject.code}</span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${subjectStatusClasses[subject.status]}`}
                >
                  {subjectStatusLabels[subject.status]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          schoolClass.status === 'ACTIVE' ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">Link subjects</h3>
              <div className="mt-3">
                <ClassSubjectForm
                  workspaceId={currentWorkspace.id}
                  classId={schoolClass.id}
                  subjects={subjectPicker}
                  selectedSubjectIds={classSubjects.items.map((row) => row.id)}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              This class is archived. Reactivate it to change its subjects.
            </p>
          )
        ) : null}
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Weekly timetable</h2>
            <p className="mt-1 text-sm text-slate-500">Recurring periods for this class.</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {schedule.items.length} slots
          </span>
        </div>

        {canManage && schoolClass.status !== 'ACTIVE' ? (
          <p className="mt-4 text-sm text-slate-500">
            This class is archived. Reactivate it to change the timetable.
          </p>
        ) : null}

        <div className="mt-4">
          <ClassScheduleManager
            workspaceId={currentWorkspace.id}
            classId={schoolClass.id}
            canManage={canManage && schoolClass.status === 'ACTIVE'}
            slots={schedule.items}
            subjects={classSubjects.items}
            teachers={teacherDirectory}
          />
        </div>
      </section>

      <section
        id="attendance"
        className="mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Attendance</h2>
            <p className="mt-1 text-sm text-slate-500">
              Daily register for the students currently enrolled in this class.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {initialAttendance.students.length} students
          </span>
        </div>

        <div className="mt-4">
          <AttendanceManager
            workspaceId={currentWorkspace.id}
            classId={schoolClass.id}
            canEdit={canEditAttendance}
            today={attendanceDate}
            initialRegister={initialAttendance}
            readOnlyReason={attendanceReadOnlyReason}
          />
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Attendance summary</h2>
            <p className="mt-1 text-sm text-slate-500">
              Attendance rate per student for a date range.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Last 30 days by default
          </span>
        </div>

        <div className="mt-4">
          <ClassAttendanceSummary
            workspaceId={currentWorkspace.id}
            classId={schoolClass.id}
            today={attendanceDate}
            initial={initialSummary}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Roster</h2>
            <p className="mt-1 text-sm text-slate-500">
              Current and past enrollments for this class.
            </p>
          </div>

          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search student name or code"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </div>

            <select
              name="status"
              defaultValue={status}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              {ENROLLMENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {enrollmentStatusLabels[option]}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Apply
            </button>
          </form>
        </div>

        {roster.items.length === 0 ? (
          <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <Users size={30} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No enrollments found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || status
                ? 'Try a different search or clear the filters.'
                : 'Enroll the first student to build this roster.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Enrolled</th>
                  <th className="px-3 py-3">Ended</th>
                  <th className="px-3 py-3">Status</th>
                  {canManage ? <th className="px-3 py-3">Actions</th> : null}
                </tr>
              </thead>

              <tbody>
                {roster.items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-4">
                      <Link
                        href={`/workspaces/${currentWorkspace.id}/students/${row.student.id}`}
                        className="font-semibold text-slate-900 transition hover:text-blue-600"
                      >
                        {studentFullName(row.student)}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.student.studentCode ?? 'No student code'}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-700">{formatDate(row.enrolledAt)}</td>
                    <td className="px-3 py-4 text-slate-700">
                      {row.endedAt ? formatDate(row.endedAt) : '—'}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${enrollmentStatusClasses[row.status]}`}
                      >
                        {enrollmentStatusLabels[row.status]}
                      </span>
                    </td>
                    {canManage ? (
                      <td className="px-3 py-4">
                        <EnrollmentActions
                          workspaceId={currentWorkspace.id}
                          enrollmentId={row.id}
                          status={row.status}
                          studentName={studentFullName(row.student)}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {firstItem}–{lastItem} of {roster.total}
          </p>

          <div className="flex items-center gap-2">
            {hasPrevious ? (
              <Link
                href={rosterHref(roster.page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-2 text-slate-300">
                <ChevronLeft size={16} />
                Previous
              </span>
            )}

            <span className="px-2 text-xs font-medium text-slate-500">
              Page {roster.page} of {Math.max(roster.totalPages, 1)}
            </span>

            {hasNext ? (
              <Link
                href={rosterHref(roster.page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Next
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-100 px-3 py-2 text-slate-300">
                Next
                <ChevronRight size={16} />
              </span>
            )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
