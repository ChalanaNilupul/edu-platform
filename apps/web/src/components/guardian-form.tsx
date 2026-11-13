'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  GUARDIAN_RELATIONSHIPS,
  guardianRelationshipLabels,
  type GuardianRecord,
  type GuardianRelationship,
  type StudentGuardianLink,
} from '@/lib/guardian';

type GuardianFormProps = {
  workspaceId: string;
  studentId: string;
  initial?: GuardianRecord;
};

type FormValues = {
  firstName: string;
  lastName: string;
  relationship: GuardianRelationship;
  email: string;
  phone: string;
  occupation: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  postalCode: string;
  isPrimary: boolean;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

function toValues(initial?: GuardianRecord): FormValues {
  return {
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    relationship: initial?.relationship ?? 'GUARDIAN',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    occupation: initial?.occupation ?? '',
    addressLine1: initial?.addressLine1 ?? '',
    addressLine2: initial?.addressLine2 ?? '',
    city: initial?.city ?? '',
    district: initial?.district ?? '',
    postalCode: initial?.postalCode ?? '',
    isPrimary: false,
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function GuardianForm({ workspaceId, studentId, initial }: GuardianFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toValues(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = Boolean(initial);

  function handleChange(field: keyof FormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      firstName: values.firstName.trim(),
      lastName: emptyToNull(values.lastName),
      relationship: values.relationship,
      email: emptyToNull(values.email),
      phone: emptyToNull(values.phone),
      occupation: emptyToNull(values.occupation),
      addressLine1: emptyToNull(values.addressLine1),
      addressLine2: emptyToNull(values.addressLine2),
      city: emptyToNull(values.city),
      district: emptyToNull(values.district),
      postalCode: emptyToNull(values.postalCode),
    };

    try {
      if (initial) {
        await apiFetch<GuardianRecord>(`/workspaces/${workspaceId}/guardians/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<StudentGuardianLink>(
          `/workspaces/${workspaceId}/students/${studentId}/guardians`,
          {
            method: 'POST',
            // Only send the flag when ticked so the API can default the first
            // guardian to primary contact.
            body: JSON.stringify({
              ...payload,
              ...(values.isPrimary ? { isPrimary: true } : {}),
            }),
          },
        );
      }

      router.push(`/workspaces/${workspaceId}/students/${studentId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the guardian.');
      setSaving(false);
    }
  }

  const cancelHref = `/workspaces/${workspaceId}/students/${studentId}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Guardian details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Who this person is and how they are related to the student.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={labelClass}>
              First name <span className="text-red-500">*</span>
            </label>
            <input
              id="firstName"
              value={values.firstName}
              onChange={handleChange('firstName')}
              required
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="lastName" className={labelClass}>
              Last name
            </label>
            <input
              id="lastName"
              value={values.lastName}
              onChange={handleChange('lastName')}
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="relationship" className={labelClass}>
              Relationship <span className="text-red-500">*</span>
            </label>
            <select
              id="relationship"
              value={values.relationship}
              onChange={handleChange('relationship')}
              className={inputClass}
            >
              {GUARDIAN_RELATIONSHIPS.map((relationship) => (
                <option key={relationship} value={relationship}>
                  {guardianRelationshipLabels[relationship]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="occupation" className={labelClass}>
              Occupation
            </label>
            <input
              id="occupation"
              value={values.occupation}
              onChange={handleChange('occupation')}
              maxLength={100}
              className={inputClass}
            />
          </div>

          {!isEdit ? (
            <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={values.isPrimary}
                onChange={(event) =>
                  setValues((current) => ({ ...current, isPrimary: event.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              <span>
                Primary contact
                <span className="block text-xs text-slate-500">
                  The first guardian added to a student becomes the primary contact automatically.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Contact</h2>
        <p className="mt-1 text-sm text-slate-500">How to reach the guardian.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              maxLength={254}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input
              id="phone"
              value={values.phone}
              onChange={handleChange('phone')}
              maxLength={30}
              placeholder="+94 77 000 0000"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="addressLine1" className={labelClass}>
              Address line 1
            </label>
            <input
              id="addressLine1"
              value={values.addressLine1}
              onChange={handleChange('addressLine1')}
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="addressLine2" className={labelClass}>
              Address line 2
            </label>
            <input
              id="addressLine2"
              value={values.addressLine2}
              onChange={handleChange('addressLine2')}
              maxLength={200}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="city" className={labelClass}>
              City
            </label>
            <input
              id="city"
              value={values.city}
              onChange={handleChange('city')}
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="district" className={labelClass}>
              District
            </label>
            <input
              id="district"
              value={values.district}
              onChange={handleChange('district')}
              maxLength={100}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="postalCode" className={labelClass}>
              Postal code
            </label>
            <input
              id="postalCode"
              value={values.postalCode}
              onChange={handleChange('postalCode')}
              maxLength={20}
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
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add guardian'}
        </button>
      </div>
    </form>
  );
}
