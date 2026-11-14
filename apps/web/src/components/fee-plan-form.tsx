'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  BILLING_PERIODS,
  FEE_PLAN_STATUSES,
  billingPeriodLabels,
  feePlanStatusLabels,
  type BillingPeriod,
  type FeePlanRecord,
  type FeePlanStatus,
} from '@/lib/finance';

type ClassOption = { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' };

type FeePlanFormProps = {
  workspaceId: string;
  currency: string;
  classes: ClassOption[];
  initial?: FeePlanRecord;
};

type FormValues = {
  name: string;
  description: string;
  amount: string;
  classId: string;
  billingPeriod: BillingPeriod;
  dueDay: string;
  status: FeePlanStatus;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

function toValues(initial?: FeePlanRecord): FormValues {
  return {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    amount: initial?.amount ?? '',
    classId: initial?.classId ?? '',
    billingPeriod: initial?.billingPeriod ?? 'MONTHLY',
    dueDay: String(initial?.dueDay ?? 1),
    status: initial?.status ?? 'ACTIVE',
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function FeePlanForm({ workspaceId, currency, classes, initial }: FeePlanFormProps) {
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
      description: emptyToNull(values.description),
      amount: values.amount.trim(),
      classId: values.classId || null,
      billingPeriod: values.billingPeriod,
      dueDay: Number(values.dueDay),
      ...(isEdit ? { status: values.status } : {}),
    };

    try {
      if (initial) {
        await apiFetch<FeePlanRecord>(`/workspaces/${workspaceId}/finance/plans/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<FeePlanRecord>(`/workspaces/${workspaceId}/finance/plans`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      router.push(`/workspaces/${workspaceId}/finance`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the fee plan.');
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
        <h2 className="text-lg font-bold text-slate-900">Fee plan details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Monthly plans generate one fee record per enrolled student. Amounts are in {currency}.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClass}>
              Plan name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              value={values.name}
              onChange={handleChange('name')}
              required
              maxLength={120}
              placeholder="e.g. Grade 8 monthly tuition"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="amount" className={labelClass}>
              Amount ({currency}) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              value={values.amount}
              onChange={handleChange('amount')}
              required
              inputMode="decimal"
              placeholder="3500.00"
              pattern="\d{1,10}(\.\d{1,2})?"
              title="Enter a positive amount with up to 2 decimals"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="classId" className={labelClass}>
              Applies to
            </label>
            <select
              id="classId"
              value={values.classId}
              onChange={handleChange('classId')}
              className={inputClass}
            >
              <option value="">Every enrolled student</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                  {schoolClass.status === 'ARCHIVED' ? ' (archived)' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Leave empty to bill students across all active classes.
            </p>
          </div>

          <div>
            <label htmlFor="billingPeriod" className={labelClass}>
              Billing period
            </label>
            <select
              id="billingPeriod"
              value={values.billingPeriod}
              onChange={handleChange('billingPeriod')}
              className={inputClass}
            >
              {BILLING_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {billingPeriodLabels[period]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Only monthly plans can generate records for a month.
            </p>
          </div>

          <div>
            <label htmlFor="dueDay" className={labelClass}>
              Due day of month <span className="text-red-500">*</span>
            </label>
            <input
              id="dueDay"
              type="number"
              min={1}
              max={28}
              value={values.dueDay}
              onChange={handleChange('dueDay')}
              required
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Between 1 and 28 so every month has the date.
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
                {FEE_PLAN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {feePlanStatusLabels[status]}
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
          href={`/workspaces/${workspaceId}/finance`}
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
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create plan'}
        </button>
      </div>
    </form>
  );
}
