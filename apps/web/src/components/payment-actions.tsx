'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type PaymentActionsProps = {
  workspaceId: string;
  feeId: string;
  paymentId: string;
  amount: string;
};

export function PaymentActions({ workspaceId, feeId, paymentId, amount }: PaymentActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function removePayment() {
    if (!window.confirm(`Delete this ${amount} payment? The fee balance will be recalculated.`)) {
      return;
    }

    setPending(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/finance/fees/${feeId}/payments/${paymentId}`, {
        method: 'DELETE',
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete the payment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={removePayment}
        disabled={pending}
        className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        Delete
      </button>

      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
