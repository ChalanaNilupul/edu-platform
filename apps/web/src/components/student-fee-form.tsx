'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Save } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import type { StudentFeeRecord } from '@/lib/finance';
import { todayValue } from '@/lib/finance';

type ClassOption = { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' };

type StudentOption = {
  id: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
};

type StudentFeeFormProps = {
  workspaceId: string;
  currency: string;
  students: StudentOption[];
  classes: ClassOption[];
};

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const labelClass = 'text-sm font-medium text-slate-700';

export function StudentFeeForm({ workspaceId, currency, students, classes }: StudentFeeFormProps) {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayValue);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await apiFetch<StudentFeeRecord>(`/workspaces/${workspaceId}/finance/fees`, {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          classId: classId || null,
          description: description.trim(),
          amount: amount.trim(),
          dueDate,
          note: note.trim() || undefined,
        }),
      });

      router.push(`/workspaces/${workspaceId}/finance`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create the fee record.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Fee record details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use a manual record for one-off charges. Monthly fee plans generate their own records.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="studentId" className={labelClass}>
              Student <span className="text-red-500">*</span>
            </label>
            <select
              id="studentId"
              value={studentId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setStudentId(event.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {[student.firstName, student.lastName].filter(Boolean).join(' ')}
                  {student.studentCode ? ` (${student.studentCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="classId" className={labelClass}>
              Class
            </label>
            <select
              id="classId"
              value={classId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setClassId(event.target.value)}
              className={inputClass}
            >
              <option value="">No class</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                  {schoolClass.status === 'ARCHIVED' ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description <span className="text-red-500">*</span>
            </label>
            <input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              maxLength={200}
              placeholder="e.g. Admission fee"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="amount" className={labelClass}>
              Amount ({currency}) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              inputMode="decimal"
              placeholder="5000.00"
              pattern="\d{1,10}(\.\d{1,2})?"
              title="Enter a positive amount with up to 2 decimals"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="dueDate" className={labelClass}>
              Due date <span className="text-red-500">*</span>
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="note" className={labelClass}>
              Note
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={`/workspaces/${workspaceId}/finance`}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={saving || students.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Create fee record'}
        </button>
      </div>
    </form>
  );
}
