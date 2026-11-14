export const instant = false;

import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { LessonActions } from '@/components/lesson-actions';
import { LessonMaterials } from '@/components/lesson-material-manager';
import { WorkspaceAccessNotice } from '@/components/workspace-access-notice';
import type { ClassTeacherListResponse } from '@/lib/classes';
import { formatDate } from '@/lib/format-date';
import { lessonStatusClasses, lessonStatusLabels, type LessonDetailRecord } from '@/lib/lessons';
import { canManageClasses, canViewClasses, getWorkspaceSession } from '@/lib/workspace-session';

type LessonDetailPageProps = {
  params: Promise<{ workspaceId: string; classId: string; lessonId: string }>;
};

export default async function LessonDetailPage({ params }: LessonDetailPageProps) {
  const { workspaceId, classId, lessonId } = await params;
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

  const currentWorkspace = workspace;

  if (!canViewClasses(currentWorkspace.role)) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${currentWorkspace.id}/students`}
        classesHref={`/workspaces/${currentWorkspace.id}/classes`}
      >
        <WorkspaceAccessNotice
          title="Lessons are restricted"
          message="Only owners, administrators, branch managers and teachers can view this workspace's lessons."
        />
      </DashboardShell>
    );
  }

  const response = await fetch(`${apiUrl}/workspaces/${currentWorkspace.id}/lessons/${lessonId}`, {
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Lesson not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This lesson may have been deleted or belongs to another workspace.
          </p>
          <Link
            href={`/workspaces/${currentWorkspace.id}/classes`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={16} />
            Back to classes
          </Link>
        </div>
      </DashboardShell>
    );
  }

  if (!response.ok) {
    throw new Error('Unable to load the lesson.');
  }

  const lesson = (await response.json()) as LessonDetailRecord;

  if (lesson.classId !== classId) {
    return (
      <DashboardShell
        user={user}
        activePage="Classes"
        studentsHref={`/workspaces/${currentWorkspace.id}/students`}
        classesHref={`/workspaces/${currentWorkspace.id}/classes`}
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Lesson not found</h1>
          <p className="mt-2 text-sm text-slate-500">This lesson belongs to a different class.</p>
          <Link
            href={`/workspaces/${currentWorkspace.id}/classes/${classId}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={16} />
            Back to the class
          </Link>
        </div>
      </DashboardShell>
    );
  }

  let isAssignedTeacher = false;

  if (currentWorkspace.role === 'TEACHER') {
    const teachersResponse = await fetch(
      `${apiUrl}/workspaces/${currentWorkspace.id}/classes/${classId}/teachers`,
      { headers, cache: 'no-store' },
    );

    if (teachersResponse.ok) {
      const classTeachers = (await teachersResponse.json()) as ClassTeacherListResponse;
      isAssignedTeacher = classTeachers.items.some(
        (assignment) => assignment.membership.user.id === user.id,
      );
    }
  }

  const canWrite = canManageClasses(currentWorkspace.role) || isAssignedTeacher;

  return (
    <DashboardShell
      user={user}
      activePage="Classes"
      studentsHref={`/workspaces/${currentWorkspace.id}/students`}
      classesHref={`/workspaces/${currentWorkspace.id}/classes`}
    >
      <div className="mb-8">
        <Link
          href={`/workspaces/${currentWorkspace.id}/classes/${classId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Back to {lesson.class.name}
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {lesson.title}
              </h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${lessonStatusClasses[lesson.status]}`}
              >
                {lessonStatusLabels[lesson.status]}
              </span>
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <BookOpen size={14} />
                {lesson.class.name}
              </span>
              <span>•</span>
              <span>{formatDate(lesson.lessonDate)}</span>
              <span>•</span>
              <span>{lesson.subject ? lesson.subject.name : 'No subject'}</span>
              {lesson.createdBy ? (
                <>
                  <span>•</span>
                  <span>Added by {lesson.createdBy.name}</span>
                </>
              ) : null}
            </p>
          </div>

          {canWrite ? (
            <LessonActions
              workspaceId={currentWorkspace.id}
              classId={classId}
              lessonId={lesson.id}
              title={lesson.title}
              status={lesson.status}
            />
          ) : null}
        </div>
      </div>

      {lesson.description ? (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Lesson notes</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{lesson.description}</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <LessonMaterials
          workspaceId={currentWorkspace.id}
          lessonId={lesson.id}
          canWrite={canWrite}
          materials={lesson.materials}
        />
      </section>
    </DashboardShell>
  );
}
