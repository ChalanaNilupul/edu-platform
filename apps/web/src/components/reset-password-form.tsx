'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });

      router.push('/login?reset=true');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
            <GraduationCap size={30} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Choose a new password</h1>

          <p className="mt-2 text-sm text-[#64748B]">
            Your new password must be at least 12 characters long.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#0F172A]">
              New password
            </label>

            <input
              id="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 12 characters"
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium text-[#0F172A]"
            >
              Confirm new password
            </label>

            <input
              id="confirm-password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your new password"
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Updating password...' : 'Update password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#64748B]">
          <Link href="/login" className="font-semibold text-[#2563EB] hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
