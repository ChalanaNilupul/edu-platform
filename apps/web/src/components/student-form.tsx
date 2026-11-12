'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  STUDENT_STATUSES,
  studentStatusLabels,
  type StudentGender,
  type StudentRecord,
  type StudentStatus,
} from '@/lib/student';

type StudentFormProps = {
  workspaceId: string;
  initial?: StudentRecord;
};

type FormValues = {
  studentCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: StudentGender | '';
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  postalCode: string;
  school: string;
  grade: string;
  status: StudentStatus;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

function toValues(initial?: StudentRecord): FormValues {
  return {
    studentCode: initial?.studentCode ?? '',
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    dateOfBirth: initial?.dateOfBirth?.slice(0, 10) ?? '',
    gender: initial?.gender ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    addressLine1: initial?.addressLine1 ?? '',
    addressLine2: initial?.addressLine2 ?? '',
    city: initial?.city ?? '',
    district: initial?.district ?? '',
    postalCode: initial?.postalCode ?? '',
    school: initial?.school ?? '',
    grade: initial?.grade ?? '',
    status: initial?.status ?? 'ACTIVE',
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function StudentForm({ workspaceId, initial }: StudentFormProps) {
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
      studentCode: emptyToNull(values.studentCode),
      firstName: values.firstName.trim(),
      lastName: emptyToNull(values.lastName),
      dateOfBirth: values.dateOfBirth || null,
      gender: values.gender || null,
      email: emptyToNull(values.email),
      phone: emptyToNull(values.phone),
      addressLine1: emptyToNull(values.addressLine1),
      addressLine2: emptyToNull(values.addressLine2),
      city: emptyToNull(values.city),
      district: emptyToNull(values.district),
      postalCode: emptyToNull(values.postalCode),
      school: emptyToNull(values.school),
      grade: emptyToNull(values.grade),
      ...(isEdit ? { status: values.status } : {}),
    };

    try {
      if (initial) {
        await apiFetch<StudentRecord>(`/workspaces/${workspaceId}/students/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        router.push(`/workspaces/${workspaceId}/students/${initial.id}`);
      } else {
        const created = await apiFetch<StudentRecord>(`/workspaces/${workspaceId}/students`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        router.push(`/workspaces/${workspaceId}/students/${created.id}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the student.');
      setSaving(false);
    }
  }

  const cancelHref = initial
    ? `/workspaces/${workspaceId}/students/${initial.id}`
    : `/workspaces/${workspaceId}/students`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Personal details</h2>
        <p className="mt-1 text-sm text-slate-500">The name and identity used in records.</p>

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
            <label htmlFor="studentCode" className={labelClass}>
              Student code
            </label>
            <input
              id="studentCode"
              value={values.studentCode}
              onChange={handleChange('studentCode')}
              maxLength={40}
              placeholder="e.g. STU-001"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="dateOfBirth" className={labelClass}>
              Date of birth
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={values.dateOfBirth}
              onChange={handleChange('dateOfBirth')}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="gender" className={labelClass}>
              Gender
            </label>
            <select
              id="gender"
              value={values.gender}
              onChange={handleChange('gender')}
              className={inputClass}
            >
              <option value="">Not specified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
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
                {STUDENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {studentStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Contact</h2>
        <p className="mt-1 text-sm text-slate-500">How to reach the student or their family.</p>

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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Academic</h2>
        <p className="mt-1 text-sm text-slate-500">Current school and grade.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="school" className={labelClass}>
              School
            </label>
            <input
              id="school"
              value={values.school}
              onChange={handleChange('school')}
              maxLength={150}
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
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add student'}
        </button>
      </div>
    </form>
  );
}
