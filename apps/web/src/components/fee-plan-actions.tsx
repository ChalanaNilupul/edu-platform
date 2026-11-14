'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Archive, ArchiveRestore, Loader2, Sparkles } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  currentMonthValue,
  type BillingPeriod,
  type FeeGenerationResult,
  type FeePlanStatus,
} from '@/lib/finance';

type FeePlanActionsProps = {
  workspaceId: string;
  planId: string;
  planName: string;
  status: FeePlanStatus;
  billingPeriod: BillingPeriod;
};

export function FeePlanActions({
  workspaceId,
  planId,
  planName,
  status,
  billingPeriod,
}: FeePlanActionsProps) {
  const router = useRouter();
  const [period, setPeriod] = useState(currentMonthValue);
  const [pending, setPending] = useState<'generate' | 'status' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const nextStatus: FeePlanStatus = status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
  const StatusIcon = nextStatus === 'ARCHIVED' ? Archive : ArchiveRestore;
  const canGenerate = status === 'ACTIVE' && billingPeriod === 'MONTHLY';

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending('generate');
    setError('');
    setResult('');

    try {
      const outcome = await apiFetch<FeeGenerationResult>(
        `/workspaces/${workspaceId}/finance/plans/${planId}/generate`,
        {
          method: 'POST',
          body: JSON.stringify({ period }),
        },
      );

      setResult(
        `${outcome.periodLabel}: ${outcome.created} created, ${outcome.skipped} already existed.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to generate fee records.');
    } finally {
      setPending(null);
    }
  }

  async function changeStatus() {
    const confirmed = window.confirm(
      nextStatus === 'ARCHIVED'
        ? `Archive ${planName}? Existing fee records stay untouched, but the plan can no longer generate new ones.`
        : `Reactivate ${planName}?`,
    );

    if (!confirmed) {
      return;
    }

    setPending('status');
    setError('');
    setResult('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/finance/plans/${planId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the fee plan.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {canGenerate ? (
          <form onSubmit={generate} className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              required
              aria-label={`Billing month for ${planName}`}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={pending !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'generate' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Generate
            </button>
          </form>
        ) : null}

        <button
          type="button"
          onClick={changeStatus}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'status' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <StatusIcon size={14} />
          )}
          {status === 'ACTIVE' ? 'Archive' : 'Reactivate'}
        </button>
      </div>

      {result ? <p className="text-xs font-medium text-emerald-600">{result}</p> : null}

      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
