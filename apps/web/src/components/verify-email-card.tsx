'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailCard({ token }: { token: string }) {
  const started = useRef(false);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    void apiFetch<{ message: string }>('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((result) => {
        setStatus('success');
        setMessage(result.message);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Unable to verify your email.');
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
          <GraduationCap size={30} />
        </div>

        <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Email verification</h1>

        {status === 'loading' ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#64748B]">
            <Loader2 size={18} className="animate-spin" />
            Verifying your email address...
          </p>
        ) : status === 'success' ? (
          <div className="mt-6">
            <p className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              {message}
            </p>

            <Link
              href="/login?verified=true"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Continue to sign in
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              {message}
            </p>

            <Link
              href="/login"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-slate-50"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
