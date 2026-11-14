'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import type { LessonStatus } from '@/lib/lessons';

type LessonActionsProps = {
  workspaceId: string;
  classId: string;
  lessonId: string;
  title: string;
  status: LessonStatus;
};

export function LessonActions({
  workspaceId,
  classId,
  lessonId,
  title,
  status,
}: LessonActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<'status' | 'delete' | null>(null);
  const [error, setError] = useState('');

  const nextStatus: LessonStatus = status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  const StatusIcon = nextStatus === 'PUBLISHED' ? Eye : EyeOff;

  async function toggleStatus() {
    setPending('status');
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/lessons/${lessonId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update the lesson.');
      setPending(null);
    }
  }

  async function removeLesson() {
    if (!window.confirm(`Delete "${title}"? Its materials will be removed too.`)) {
      return;
    }

    setPending('delete');
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/lessons/${lessonId}`, { method: 'DELETE' });
      router.push(`/workspaces/${workspaceId}/classes/${classId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to delete the lesson.');
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={pending !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'status' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <StatusIcon size={16} />
          )}
          {status === 'PUBLISHED' ? 'Move to draft' : 'Publish'}
        </button>

        <button
          type="button"
          onClick={removeLesson}
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
