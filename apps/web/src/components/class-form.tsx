'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  CLASS_STATUSES,
  classStatusLabels,
  type ClassRecord,
  type ClassStatus,
} from '@/lib/classes';

type ClassFormProps = {
  workspaceId: string;
  initial?: ClassRecord;
};

type FormValues = {
  name: string;
  grade: string;
  description: string;
  capacity: string;
  status: ClassStatus;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

function toValues(initial?: ClassRecord): FormValues {
  return {
    name: initial?.name ?? '',
    grade: initial?.grade ?? '',
    description: initial?.description ?? '',
    capacity: initial?.capacity?.toString() ?? '',
    status: initial?.status ?? 'ACTIVE',
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function ClassForm({ workspaceId, initial }: ClassFormProps) {
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

    const capacity = values.capacity.trim();
    const payload = {
      name: values.name.trim(),
      grade: emptyToNull(values.grade),
      description: emptyToNull(values.description),
      capacity: capacity.length > 0 ? Number(capacity) : null,
      ...(isEdit ? { status: values.status } : {}),
    };

    if (capacity.length > 0 && (!Number.isInteger(Number(capacity)) || Number(capacity) < 1)) {
      setError('Capacity must be a whole number of 1 or more, or left empty.');
      setSaving(false);
      return;
    }

    try {
      if (initial) {
        await apiFetch<ClassRecord>(`/workspaces/${workspaceId}/classes/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        router.push(`/workspaces/${workspaceId}/classes/${initial.id}`);
      } else {
        const created = await apiFetch<ClassRecord>(`/workspaces/${workspaceId}/classes`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        router.push(`/workspaces/${workspaceId}/classes/${created.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the class.');
      setSaving(false);
    }
  }

  const cancelHref = initial
    ? `/workspaces/${workspaceId}/classes/${initial.id}`
    : `/workspaces/${workspaceId}/classes`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Class details</h2>
        <p className="mt-1 text-sm text-slate-500">
          The name students and teachers will recognise, plus an optional capacity.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelClass}>
              Class name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              value={values.name}
              onChange={handleChange('name')}
              required
              maxLength={120}
              placeholder="e.g. Grade 8 Science"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="grade" className={labelClass}>
              Grade
            </label>
            <input
              id="grade"
              value={values.grade}
              onChange={handleChange('grade')}
              maxLength={50}
              placeholder="e.g. Grade 8"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="capacity" className={labelClass}>
              Capacity
            </label>
            <input
              id="capacity"
              type="number"
              min={1}
              max={1000}
              value={values.capacity}
              onChange={handleChange('capacity')}
              placeholder="Unlimited"
              className={inputClass}
            />
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
                {CLASS_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {classStatusLabels[status]}
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
          href={cancelHref}
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
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create class'}
        </button>
      </div>
    </form>
  );
}
