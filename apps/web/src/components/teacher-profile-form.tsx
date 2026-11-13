'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import type { TeacherProfile } from '@/lib/teachers';

type TeacherProfileFormProps = {
  workspaceId: string;
  membershipId: string;
  teacherName: string;
  initial?: TeacherProfile | null;
};

type FormValues = {
  phone: string;
  qualifications: string;
  specializations: string;
  joinedAt: string;
  bio: string;
  notes: string;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

function toValues(initial?: TeacherProfile | null): FormValues {
  return {
    phone: initial?.phone ?? '',
    qualifications: initial?.qualifications ?? '',
    specializations: initial?.specializations.join(', ') ?? '',
    joinedAt: initial?.joinedAt ? initial.joinedAt.slice(0, 10) : '',
    bio: initial?.bio ?? '',
    notes: initial?.notes ?? '',
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function TeacherProfileForm({
  workspaceId,
  membershipId,
  teacherName,
  initial,
}: TeacherProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleChange(field: keyof FormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const specializations = Array.from(
      new Set(
        values.specializations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    if (specializations.length > 10) {
      setError('List at most 10 specializations.');
      return;
    }

    if (specializations.some((item) => item.length > 50)) {
      setError('Each specialization must be 50 characters or fewer.');
      return;
    }

    setSaving(true);

    try {
      await apiFetch(`/workspaces/${workspaceId}/teachers/${membershipId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: emptyToNull(values.phone),
          qualifications: emptyToNull(values.qualifications),
          specializations,
          joinedAt: emptyToNull(values.joinedAt),
          bio: emptyToNull(values.bio),
          notes: emptyToNull(values.notes),
        }),
      });

      router.push(`/workspaces/${workspaceId}/teachers/${membershipId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the profile.');
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
        <h2 className="text-lg font-bold text-slate-900">Profile details</h2>
        <p className="mt-1 text-sm text-slate-500">
          These details appear in the teacher directory for {teacherName}. Leave a field empty to
          clear it.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input
              id="phone"
              value={values.phone}
              onChange={handleChange('phone')}
              maxLength={30}
              placeholder="e.g. 077 123 4567"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="joinedAt" className={labelClass}>
              Teaching since
            </label>
            <input
              id="joinedAt"
              type="date"
              value={values.joinedAt}
              onChange={handleChange('joinedAt')}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="qualifications" className={labelClass}>
              Qualifications
            </label>
            <input
              id="qualifications"
              value={values.qualifications}
              onChange={handleChange('qualifications')}
              maxLength={200}
              placeholder="e.g. B.Sc. Mathematics, PGDE"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="specializations" className={labelClass}>
              Specializations
            </label>
            <input
              id="specializations"
              value={values.specializations}
              onChange={handleChange('specializations')}
              placeholder="Comma separated, e.g. Mathematics, Physics"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">Up to 10 subjects, 50 characters each.</p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="bio" className={labelClass}>
              Bio
            </label>
            <textarea
              id="bio"
              value={values.bio}
              onChange={handleChange('bio')}
              maxLength={2000}
              rows={4}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelClass}>
              Internal notes
            </label>
            <textarea
              id="notes"
              value={values.notes}
              onChange={handleChange('notes')}
              maxLength={2000}
              rows={3}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Visible to staff who can open this profile.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={`/workspaces/${workspaceId}/teachers/${membershipId}`}
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
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}
