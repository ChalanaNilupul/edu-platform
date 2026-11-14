'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, UserPlus } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import { teacherName, type TeacherRecord } from '@/lib/teachers';

type AssignTeacherFormProps = {
  workspaceId: string;
  classId: string;
  teachers: TeacherRecord[];
  assignedMembershipIds: string[];
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function AssignTeacherForm({
  workspaceId,
  classId,
  teachers,
  assignedMembershipIds,
}: AssignTeacherFormProps) {
  const router = useRouter();
  const available = teachers.filter((teacher) => !assignedMembershipIds.includes(teacher.id));
  const [membershipId, setMembershipId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function assignTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!membershipId) {
      setError('Choose a teacher to assign.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/teachers`, {
        method: 'POST',
        body: JSON.stringify({ membershipId, isPrimary }),
      });

      setMembershipId('');
      setIsPrimary(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to assign the teacher.');
    } finally {
      setSaving(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
        Every teacher in this workspace is already assigned to this class.
      </p>
    );
  }

  return (
    <form onSubmit={assignTeacher} className="space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="teacherMembershipId" className="text-sm font-medium text-slate-700">
            Teacher
          </label>
          <select
            id="teacherMembershipId"
            value={membershipId}
            onChange={(event) => setMembershipId(event.target.value)}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Choose a teacher</option>
            {available.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacherName(teacher)} · {teacher.user.email}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          Primary teacher
        </label>

        <button
          type="submit"
          disabled={saving || !membershipId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {saving ? 'Assigning...' : 'Assign teacher'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        A class can have one primary teacher. Setting another teacher as primary clears the previous
        one.
      </p>
    </form>
  );
}
