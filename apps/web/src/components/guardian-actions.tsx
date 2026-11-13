'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';

type GuardianActionsProps = {
  workspaceId: string;
  studentId: string;
  guardianId: string;
  guardianName: string;
};

export function GuardianActions({
  workspaceId,
  studentId,
  guardianId,
  guardianName,
}: GuardianActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function removeGuardian() {
    const confirmed = window.confirm(
      `Remove ${guardianName} from this student? The guardian record will also be deleted.`,
    );

    if (!confirmed) {
      return;
    }

    setPending(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/students/${studentId}/guardians/${guardianId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove the guardian.');
      setPending(false);
      return;
    }

    try {
      await apiFetch(`/workspaces/${workspaceId}/guardians/${guardianId}`, {
        method: 'DELETE',
      });
    } catch {
      // The student link is already gone, so surface the leftover record instead of retrying.
      setError('The guardian was unlinked, but the guardian record could not be deleted.');
      setPending(false);
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={removeGuardian}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {pending ? 'Removing...' : 'Remove'}
      </button>

      {error ? (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
