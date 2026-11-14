'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import type { SubjectRecord } from '@/lib/subjects';

type ClassSubjectFormProps = {
  workspaceId: string;
  classId: string;
  subjects: SubjectRecord[];
  selectedSubjectIds: string[];
};

export function ClassSubjectForm({
  workspaceId,
  classId,
  subjects,
  selectedSubjectIds,
}: ClassSubjectFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(selectedSubjectIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initialKey = [...selectedSubjectIds].sort().join(',');
  const currentKey = [...selected].sort().join(',');
  const dirty = initialKey !== currentKey;

  function toggle(subjectId: string) {
    setSelected((current) =>
      current.includes(subjectId)
        ? current.filter((id) => id !== subjectId)
        : [...current, subjectId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/subjects`, {
        method: 'PUT',
        body: JSON.stringify({ subjectIds: selected }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the class subjects.');
    } finally {
      setSaving(false);
    }
  }

  if (subjects.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No subjects in the catalogue yet.{' '}
        <Link
          href={`/workspaces/${workspaceId}/subjects/new`}
          className="font-semibold text-blue-600 transition hover:text-blue-700"
        >
          Create the first subject
        </Link>{' '}
        to attach it here.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {subjects.map((subject) => {
          const checked = selected.includes(subject.id);

          return (
            <label
              key={subject.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(subject.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              <span>
                <span className="font-medium text-slate-800">{subject.name}</span>
                {subject.code ? (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                    {subject.code}
                  </span>
                ) : null}
                {subject.status === 'ARCHIVED' ? (
                  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                    Archived
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving || !dirty}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving...' : 'Save subjects'}
      </button>
    </form>
  );
}
