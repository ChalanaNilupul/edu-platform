'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import type { EnrollmentStatus } from '@/lib/classes';

type EnrollmentActionsProps = {
  workspaceId: string;
  enrollmentId: string;
  status: EnrollmentStatus;
  studentName: string;
};

export function EnrollmentActions({
  workspaceId,
  enrollmentId,
  status,
  studentName,
}: EnrollmentActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<EnrollmentStatus | null>(null);
  const [error, setError] = useState('');

  async function changeStatus(next: EnrollmentStatus) {
    if (next !== 'ACTIVE') {
      const confirmed = window.confirm(
        next === 'COMPLETED'
          ? `Mark ${studentName}'s enrollment as completed?`
          : `Withdraw ${studentName} from this class? The enrollment stays in the history.`,
      );

      if (!confirmed) {
        return;
      }
    }

    setPending(next);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the enrollment.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        {status === 'ACTIVE' ? (
          <>
            <button
              type="button"
              onClick={() => changeStatus('COMPLETED')}
              disabled={pending !== null}
              className="inline-flex items-center gap-1.5 text-emerald-700 transition hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'COMPLETED' ? <Loader2 size={14} className="animate-spin" /> : null}
              Complete
            </button>

            <button
              type="button"
              onClick={() => changeStatus('WITHDRAWN')}
              disabled={pending !== null}
              className="inline-flex items-center gap-1.5 text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'WITHDRAWN' ? <Loader2 size={14} className="animate-spin" /> : null}
              Withdraw
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => changeStatus('ACTIVE')}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'ACTIVE' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            Reactivate
          </button>
        )}
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
