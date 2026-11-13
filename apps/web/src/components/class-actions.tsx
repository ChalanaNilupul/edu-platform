'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Archive, ArchiveRestore, Loader2, Trash2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import type { ClassStatus } from '@/lib/classes';

type ClassActionsProps = {
  workspaceId: string;
  classId: string;
  className: string;
  status: ClassStatus;
  enrolledCount: number;
};

export function ClassActions({
  workspaceId,
  classId,
  className,
  status,
  enrolledCount,
}: ClassActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<'status' | 'delete' | null>(null);
  const [error, setError] = useState('');

  const nextStatus: ClassStatus = status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
  const StatusIcon = nextStatus === 'ARCHIVED' ? Archive : ArchiveRestore;

  async function changeStatus() {
    const confirmed = window.confirm(
      nextStatus === 'ARCHIVED'
        ? `Archive ${className}? Students stay enrolled but the class cannot accept new enrollments.`
        : `Reactivate ${className}?`,
    );

    if (!confirmed) {
      return;
    }

    setPending('status');
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the class.');
    } finally {
      setPending(null);
    }
  }

  async function removeClass() {
    const confirmed = window.confirm(
      enrolledCount > 0
        ? `${className} has ${enrolledCount} active enrollment(s). Archive it instead of deleting.`
        : `Delete ${className}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setPending('delete');
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}`, { method: 'DELETE' });
      router.push(`/workspaces/${workspaceId}/classes`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete the class.');
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={changeStatus}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'status' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <StatusIcon size={16} />
          )}
          {status === 'ACTIVE' ? 'Archive' : 'Reactivate'}
        </button>

        <button
          type="button"
          onClick={removeClass}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'delete' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          Delete
        </button>
      </div>

      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
