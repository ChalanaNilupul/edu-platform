export const instant = false;

import Link from 'next/link';
import { AlertCircle, GraduationCap } from 'lucide-react';

import { VerifyEmailCard } from '@/components/verify-email-card';

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
        <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
            <GraduationCap size={30} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Verification link is invalid</h1>

          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            This verification link is missing its token. Sign in and request a new verification
            email.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return <VerifyEmailCard token={token} />;
}
