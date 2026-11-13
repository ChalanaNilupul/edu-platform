'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Search, UserPlus } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import { studentFullName, type StudentListResponse, type StudentRecord } from '@/lib/student';

type EnrollStudentFormProps = {
  workspaceId: string;
  classId: string;
  enrolledStudentIds: string[];
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function EnrollStudentForm({
  workspaceId,
  classId,
  enrolledStudentIds,
}: EnrollStudentFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [enrolledAt, setEnrolledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const excluded = new Set(enrolledStudentIds);

  async function searchStudents(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError('');

    try {
      const params = new URLSearchParams({ pageSize: '10' });

      if (query.trim()) {
        params.set('search', query.trim());
      }

      const data = await apiFetch<StudentListResponse>(
        `/workspaces/${workspaceId}/students?${params.toString()}`,
      );

      setResults(data.items.filter((student) => !excluded.has(student.id)));
      setSelectedId('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to search students.');
    } finally {
      setSearching(false);
    }
  }

  async function enrollStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedId) {
      setError('Choose a student to enroll.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedId,
          ...(enrolledAt ? { enrolledAt } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });

      setSelectedId('');
      setEnrolledAt('');
      setNotes('');
      setResults((current) => current?.filter((student) => student.id !== selectedId) ?? current);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to enroll the student.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={searchStudents} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or student code"
            className={`${inputClass} pl-9`}
          />
        </div>

        <button
          type="submit"
          disabled={searching}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Find students
        </button>
      </form>

      {results !== null ? (
        results.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
            No students match that search. Every matching student may already be enrolled.
          </p>
        ) : (
          <form onSubmit={enrollStudent} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Choose a student</legend>

              {results.map((student) => (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="studentId"
                    value={student.id}
                    checked={selectedId === student.id}
                    onChange={() => setSelectedId(student.id)}
                  />
                  <span>
                    <span className="font-semibold text-slate-900">{studentFullName(student)}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {student.studentCode ?? 'No code'}
                      {student.grade ? ` · ${student.grade}` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="enrolledAt" className="text-sm font-medium text-slate-700">
                  Enrollment date
                </label>
                <input
                  id="enrolledAt"
                  type="date"
                  value={enrolledAt}
                  onChange={(event) => setEnrolledAt(event.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
                <p className="mt-1 text-xs text-slate-500">Leave empty for today.</p>
              </div>

              <div>
                <label htmlFor="enrollmentNotes" className="text-sm font-medium text-slate-700">
                  Notes
                </label>
                <input
                  id="enrollmentNotes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !selectedId}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {saving ? 'Enrolling...' : 'Enroll student'}
            </button>
          </form>
        )
      ) : null}
    </div>
  );
}
