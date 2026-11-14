'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Star, UserMinus } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type ClassTeacherActionsProps = {
  workspaceId: string;
  classId: string;
  assignmentId: string;
  teacherName: string;
  isPrimary: boolean;
};

export function ClassTeacherActions({
  workspaceId,
  classId,
  assignmentId,
  teacherName,
  isPrimary,
}: ClassTeacherActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<'primary' | 'remove' | null>(null);
  const [error, setError] = useState('');

  async function makePrimary() {
    setPending('primary');
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/teachers/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPrimary: true }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the assignment.');
    } finally {
      setPending(null);
    }
  }

  async function removeAssignment() {
    const confirmed = window.confirm(
      `Remove ${teacherName} from this class? The assignment stays in the history.`,
    );

    if (!confirmed) {
      return;
    }

    setPending('remove');
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/teachers/${assignmentId}`, {
        method: 'DELETE',
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove the assignment.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        {isPrimary ? null : (
          <button
            type="button"
            onClick={makePrimary}
            disabled={pending !== null}
            className="inline-flex items-center gap-1.5 text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'primary' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Star size={14} />
            )}
            Make primary
          </button>
        )}

        <button
          type="button"
          onClick={removeAssignment}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'remove' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UserMinus size={14} />
          )}
          Remove
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
