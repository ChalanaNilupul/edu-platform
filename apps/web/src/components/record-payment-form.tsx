'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  PAYMENT_METHODS,
  paymentMethodLabels,
  todayValue,
  type PaymentMethod,
  type PaymentRecord,
  type StudentFeeDetail,
} from '@/lib/finance';

type RecordPaymentFormProps = {
  workspaceId: string;
  feeId: string;
  currency: string;
  outstanding: string;
  disabled?: boolean;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

export function RecordPaymentForm({
  workspaceId,
  feeId,
  currency,
  outstanding,
  disabled = false,
}: RecordPaymentFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(outstanding);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [paidAt, setPaidAt] = useState(todayValue);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receiptHref, setReceiptHref] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    setReceiptHref('');

    try {
      const outcome = await apiFetch<{ payment: PaymentRecord; fee: StudentFeeDetail }>(
        `/workspaces/${workspaceId}/finance/fees/${feeId}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount: amount.trim(),
            method,
            paidAt,
            reference: reference.trim() || undefined,
            note: note.trim() || undefined,
          }),
        },
      );

      setSuccess(
        outcome.fee.balance === '0.00'
          ? 'Payment recorded. This fee is now fully paid.'
          : `Payment recorded. Remaining balance: ${outcome.fee.balance}.`,
      );
      setReceiptHref(`/workspaces/${workspaceId}/finance/receipts/${outcome.payment.id}`);
      setAmount(outcome.fee.balance);
      setReference('');
      setNote('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to record the payment.');
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Voided fee records cannot accept payments.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>
            {success}
            {receiptHref ? (
              <Link
                href={receiptHref}
                className="ml-1 font-semibold underline underline-offset-2 transition hover:text-emerald-900"
              >
                Open receipt
              </Link>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="payment-amount" className={labelClass}>
            Amount ({currency}) <span className="text-red-500">*</span>
          </label>
          <input
            id="payment-amount"
            value={amount}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
            required
            inputMode="decimal"
            pattern="\d{1,10}(\.\d{1,2})?"
            title="Enter a positive amount with up to 2 decimals"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">Outstanding balance: {outstanding}.</p>
        </div>

        <div>
          <label htmlFor="payment-method" className={labelClass}>
            Method
          </label>
          <select
            id="payment-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            className={inputClass}
          >
            {PAYMENT_METHODS.map((option) => (
              <option key={option} value={option}>
                {paymentMethodLabels[option]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="payment-date" className={labelClass}>
            Paid on <span className="text-red-500">*</span>
          </label>
          <input
            id="payment-date"
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="payment-reference" className={labelClass}>
            Reference
          </label>
          <input
            id="payment-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={100}
            placeholder="Bank slip or receipt number"
            className={inputClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="payment-note" className={labelClass}>
            Note
          </label>
          <input
            id="payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            className={inputClass}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {saving ? 'Recording...' : 'Record payment'}
      </button>
    </form>
  );
}
