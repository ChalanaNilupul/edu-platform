'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Ban, Loader2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type FeeActionsProps = {
  workspaceId: string;
  feeId: string;
  description: string;
  status: string;
  paymentCount: number;
};

export function FeeActions({
  workspaceId,
  feeId,
  description,
  status,
  paymentCount,
}: FeeActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (status === 'VOID') {
    return null;
  }

  async function voidFee() {
    const confirmed = window.confirm(
      paymentCount > 0
        ? `${description} has recorded payments. Remove them before voiding this fee.`
        : `Void ${description}? The fee stays in reports but can no longer receive payments.`,
    );

    if (!confirmed) {
      return;
    }

    setPending(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/finance/fees/${feeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'VOID' }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to void the fee.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={voidFee}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
        Void fee
      </button>

      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
