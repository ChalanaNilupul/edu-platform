export const instant = false;

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertCircle, GraduationCap } from 'lucide-react';

import { AcceptInvitationCard } from '@/components/accept-invitation-card';

type AcceptInvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitationPage({ searchParams }: AcceptInvitationPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
        <section className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB] text-white">
            <GraduationCap size={30} />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#0F172A]">Invitation not found</h1>

          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            This invitation link is missing its token. Ask a workspace administrator to send a new
            invitation.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#0F172A] transition hover:bg-slate-50"
          >
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();

  if (!cookieStore.get('edu_session')?.value) {
    const next = `/invitations/accept?token=${encodeURIComponent(token)}`;

    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <AcceptInvitationCard token={token} />
    </main>
  );
}
