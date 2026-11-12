'use client';

import Link from 'next/link';
import { useState } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Invalid email or password.',
        );
      }

      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
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

          <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Welcome back</h1>

          <p className="mt-2 text-sm text-[#64748B]">Sign in to your EduPlatform account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#0F172A]">
              Email address
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-3 text-sm text-[#0F172A] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#0F172A]">
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#64748B]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-[#2563EB] hover:underline">
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}
