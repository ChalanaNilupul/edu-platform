import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

type WorkspaceAccessNoticeProps = {
  title?: string;
  message?: string;
};

export function WorkspaceAccessNotice({
  title = 'You do not have access to this workspace',
  message = 'Ask a workspace administrator to invite you, or switch to a workspace you belong to.',
}: WorkspaceAccessNoticeProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      <p className="flex items-center gap-2 font-semibold text-amber-800">
        <ShieldAlert size={20} />
        {title}
      </p>
      <p className="mt-2 text-sm text-amber-700">{message}</p>
      <Link
        href="/workspaces"
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
      >
        <ArrowLeft size={16} />
        Back to workspaces
      </Link>
    </section>
  );
}
