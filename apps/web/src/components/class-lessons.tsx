'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, BookOpen, FileText, Loader2, Plus, X } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/format-date';
import { lessonStatusClasses, lessonStatusLabels, type LessonRecord } from '@/lib/lessons';
import type { SubjectRecord } from '@/lib/subjects';

type ClassLessonsProps = {
  workspaceId: string;
  classId: string;
  canWrite: boolean;
  readOnlyNote?: string;
  lessons: LessonRecord[];
  subjects: SubjectRecord[];
  defaultDate: string;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function ClassLessons({
  workspaceId,
  classId,
  canWrite,
  readOnlyNote,
  lessons,
  subjects,
  defaultDate,
}: ClassLessonsProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [lessonDate, setLessonDate] = useState(defaultDate);
  const [subjectId, setSubjectId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeSubjects = subjects.filter((subject) => subject.status === 'ACTIVE');

  function resetForm() {
    setTitle('');
    setLessonDate(defaultDate);
    setSubjectId('');
    setDescription('');
    setError('');
  }

  async function createLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          lessonDate,
          ...(subjectId ? { subjectId } : {}),
          ...(description.trim() ? { description } : {}),
        }),
      });

      resetForm();
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create the lesson.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Lessons</h2>
          <p className="mt-1 text-sm text-slate-500">
            Planned sessions with the PDF, video and link materials for each one.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {lessons.length} lessons
          </span>

          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setFormOpen((open) => !open);
                setError('');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {formOpen ? <X size={16} /> : <Plus size={16} />}
              {formOpen ? 'Close' : 'New lesson'}
            </button>
          ) : null}
        </div>
      </div>

      {readOnlyNote ? <p className="mt-3 text-sm text-slate-500">{readOnlyNote}</p> : null}

      {formOpen && canWrite ? (
        <form
          onSubmit={createLesson}
          className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2"
        >
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              placeholder="Introduction to fractions"
              className={inputClass}
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Date
            </span>
            <input
              type="date"
              value={lessonDate}
              onChange={(event) => setLessonDate(event.target.value)}
              required
              className={inputClass}
            />
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subject
            </span>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className={inputClass}
            >
              <option value="">No subject</option>
              {activeSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="What the lesson covers"
              className={inputClass}
            />
          </label>

          {error ? (
            <p className="flex items-start gap-1 text-sm text-red-600 sm:col-span-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create lesson
            </button>
          </div>
        </form>
      ) : null}

      {lessons.length === 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          <BookOpen size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <p>No lessons yet. Lessons you create will appear here with their materials.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/workspaces/${workspaceId}/classes/${classId}/lessons/${lesson.id}`}
                className="flex flex-col gap-2 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{lesson.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{formatDate(lesson.lessonDate)}</span>
                    {lesson.subject ? <span>• {lesson.subject.name}</span> : null}
                    {lesson.createdBy ? <span>• {lesson.createdBy.name}</span> : null}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <FileText size={12} />
                    {lesson.materialCount} materials
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lessonStatusClasses[lesson.status]}`}
                  >
                    {lessonStatusLabels[lesson.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
