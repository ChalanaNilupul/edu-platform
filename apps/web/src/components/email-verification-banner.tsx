'use client';

import { useState } from 'react';
import { AlertTriangle, MailCheck } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type ResendState = 'idle' | 'sending' | 'sent';

export function EmailVerificationBanner() {
  const [state, setState] = useState<ResendState>('idle');
  const [error, setError] = useState('');

  async function resend() {
    setState('sending');
    setError('');

    try {
      await apiFetch('/auth/email/resend', { method: 'POST' });
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to resend the email.');
      setState('idle');
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            {state === 'sent' ? <MailCheck size={18} /> : <AlertTriangle size={18} />}
          </div>

          <div>
            <p className="text-sm font-semibold text-amber-900">
              {state === 'sent' ? 'Verification email sent' : 'Verify your email address'}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {state === 'sent'
                ? 'Open the link in the new email to finish setting up your account.'
                : 'You need a verified email before you can create a workspace or invite members.'}
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending' || state === 'sent'}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending...' : state === 'sent' ? 'Email sent' : 'Resend email'}
        </button>
      </div>
    </div>
  );
}
