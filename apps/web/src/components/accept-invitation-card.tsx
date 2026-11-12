'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, GraduationCap, Loader2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type AcceptedInvitation = {
  message: string;
  workspace: {
    id: string;
    name: string;
    type: 'TEACHER' | 'INSTITUTE';
  };
};

type VerificationState = 'unknown' | 'pending' | 'verified';

export function AcceptInvitationCard({ token }: { token: string }) {
  const [result, setResult] = useState<AcceptedInvitation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<VerificationState>('unknown');
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void apiFetch<{ user: { emailVerifiedAt: string | null } }>('/auth/me')
      .then((session) => {
        if (!cancelled) {
          setVerification(session.user.emailVerifiedAt ? 'verified' : 'pending');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVerification('unknown');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckAgain() {
    try {
      const session = await apiFetch<{ user: { emailVerifiedAt: string | null } }>('/auth/me');

      setVerification(session.user.emailVerifiedAt ? 'verified' : 'pending');
    } catch {
      setVerification('unknown');
    }
  }

  async function handleResend() {
    setResend('sending');
    setResendError('');

    try {
      await apiFetch('/auth/email/resend', { method: 'POST' });
      setResend('sent');
    } catch (err) {
      setResend('idle');
      setResendError(err instanceof ApiError ? err.message : 'Unable to resend the email.');
    }
  }

  async function handleAccept() {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch<AcceptedInvitation>('/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to accept this invitation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
        <GraduationCap size={30} />
      </div>

      <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Workspace invitation</h1>

      {result ? (
        <div className="mt-6">
          <p className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 size={18} />
            {result.message}
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{result.workspace.name}</p>
                <p className="text-xs text-slate-500">
                  {result.workspace.type === 'TEACHER'
                    ? 'Teacher workspace'
                    : 'Institute workspace'}
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/workspaces"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Go to workspaces
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-sm text-[#64748B]">
            You have been invited to join a workspace on EduPlatform. Accept the invitation to start
            collaborating.
          </p>

          {verification === 'pending' && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-800">
              <p className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>
                  Verify your email address before accepting this invitation. We sent a verification
                  link when you registered.
                </span>
              </p>

              {resend === 'sent' ? (
                <p className="mt-2 pl-6 text-xs text-amber-700">
                  Verification email sent. Check your inbox, then check again below.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={resend === 'sending'}
                  className="mt-2 ml-6 text-xs font-semibold text-amber-900 underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resend === 'sending' ? 'Sending...' : 'Resend verification email'}
                </button>
              )}

              {resendError && (
                <p role="alert" className="mt-2 pl-6 text-xs text-red-700">
                  {resendError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void handleCheckAgain()}
                className="mt-2 ml-6 block text-xs font-semibold text-amber-900 underline hover:no-underline"
              >
                I have verified my email
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={loading || verification === 'pending'}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Accepting...' : 'Accept invitation'}
          </button>

          <Link
            href="/workspaces"
            className="mt-4 inline-flex text-sm font-medium text-[#64748B] hover:text-[#2563EB]"
          >
            Not now
          </Link>
        </div>
      )}
    </section>
  );
}
