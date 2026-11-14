'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  SUBJECT_STATUSES,
  subjectStatusLabels,
  type SubjectRecord,
  type SubjectStatus,
} from '@/lib/subjects';

type SubjectFormProps = {
  workspaceId: string;
  initial?: SubjectRecord;
};

type FormValues = {
  name: string;
  code: string;
  description: string;
  status: SubjectStatus;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

function toValues(initial?: SubjectRecord): FormValues {
  return {
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'ACTIVE',
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function SubjectForm({ workspaceId, initial }: SubjectFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(initial);

  function handleChange(field: keyof FormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: values.name.trim(),
      code: emptyToNull(values.code),
      description: emptyToNull(values.description),
      ...(isEdit ? { status: values.status } : {}),
    };

    try {
      if (initial) {
        await apiFetch<SubjectRecord>(`/workspaces/${workspaceId}/subjects/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<SubjectRecord>(`/workspaces/${workspaceId}/subjects`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      router.push(`/workspaces/${workspaceId}/subjects`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the subject.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Subject details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Subjects are shared across the workspace and can be attached to any class.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClass}>
              Subject name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              value={values.name}
              onChange={handleChange('name')}
              required
              maxLength={120}
              placeholder="e.g. Mathematics"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="code" className={labelClass}>
              Code
            </label>
            <input
              id="code"
              value={values.code}
              onChange={handleChange('code')}
              maxLength={20}
              placeholder="e.g. MATH-G10"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Optional and unique per workspace. Stored in upper case.
            </p>
          </div>

          {isEdit ? (
            <div>
              <label htmlFor="status" className={labelClass}>
                Status
              </label>
              <select
                id="status"
                value={values.status}
                onChange={handleChange('status')}
                className={inputClass}
              >
                {SUBJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {subjectStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="sm:col-span-2">
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              value={values.description}
              onChange={handleChange('description')}
              maxLength={500}
              rows={3}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={`/workspaces/${workspaceId}/subjects`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create subject'}
        </button>
      </div>
    </form>
  );
}
