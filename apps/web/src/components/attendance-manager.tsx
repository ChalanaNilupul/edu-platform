'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Save,
  Users,
} from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  ATTENDANCE_STATUSES,
  attendanceStatusClasses,
  attendanceStatusLabels,
  attendanceStatusSelectedClasses,
  tallyAttendance,
  type AttendanceCounts,
  type AttendanceRegisterResponse,
  type AttendanceStatus,
} from '@/lib/attendance';
import { formatDate } from '@/lib/format-date';
import { studentFullName } from '@/lib/student';

type AttendanceManagerProps = {
  workspaceId: string;
  classId: string;
  canEdit: boolean;
  today: string;
  initialRegister: AttendanceRegisterResponse;
  readOnlyReason?: string;
};

type Mark = { status: AttendanceStatus | null; note: string };

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function marksFrom(register: AttendanceRegisterResponse): Record<string, Mark> {
  const marks: Record<string, Mark> = {};

  for (const student of register.students) {
    marks[student.studentId] = { status: student.status, note: student.note ?? '' };
  }

  return marks;
}

function shiftDate(date: string, days: number): string {
  const parts = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(parts[0] ?? 1970, (parts[1] ?? 1) - 1, (parts[2] ?? 1) + days));

  return shifted.toISOString().slice(0, 10);
}

function CountChip({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {label}
      <span className="rounded-full bg-white/60 px-1.5">{value}</span>
    </span>
  );
}

export function AttendanceManager({
  workspaceId,
  classId,
  canEdit,
  today,
  initialRegister,
  readOnlyReason,
}: AttendanceManagerProps) {
  const [date, setDate] = useState(initialRegister.date);
  const [register, setRegister] = useState(initialRegister);
  const [marks, setMarks] = useState<Record<string, Mark>>(() => marksFrom(initialRegister));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const busy = loading || saving;
  const students = register.students;
  const liveStatuses = students.map((student) => ({
    status: marks[student.studentId]?.status ?? null,
  }));
  const counts: AttendanceCounts = tallyAttendance(liveStatuses);
  const dirty = students.some((student) => {
    const mark = marks[student.studentId];

    return (mark?.status ?? null) !== student.status || (mark?.note ?? '') !== (student.note ?? '');
  });

  function updateMark(studentId: string, patch: Partial<Mark>) {
    setNotice('');
    setMarks((current) => ({
      ...current,
      [studentId]: {
        status: patch.status !== undefined ? patch.status : (current[studentId]?.status ?? null),
        note: patch.note !== undefined ? patch.note : (current[studentId]?.note ?? ''),
      },
    }));
  }

  function markRemainingPresent() {
    setNotice('');
    setMarks((current) => {
      const next = { ...current };

      for (const student of students) {
        if (!next[student.studentId]?.status) {
          next[student.studentId] = {
            status: 'PRESENT',
            note: next[student.studentId]?.note ?? '',
          };
        }
      }

      return next;
    });
  }

  async function changeDate(next: string) {
    if (!next || next === date) {
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      const data = await apiFetch<AttendanceRegisterResponse>(
        `/workspaces/${workspaceId}/classes/${classId}/attendance?date=${next}`,
      );

      setDate(data.date);
      setRegister(data);
      setMarks(marksFrom(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load that day’s register.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const records: { studentId: string; status: AttendanceStatus; note: string | null }[] = [];

    for (const student of students) {
      const mark = marks[student.studentId];

      if (!mark?.status) {
        continue;
      }

      records.push({
        studentId: student.studentId,
        status: mark.status,
        note: mark.note.trim() || null,
      });
    }

    if (records.length === 0) {
      setError('Mark at least one student before saving the register.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const data = await apiFetch<AttendanceRegisterResponse>(
        `/workspaces/${workspaceId}/classes/${classId}/attendance`,
        {
          method: 'PUT',
          body: JSON.stringify({ date, records }),
        },
      );

      setRegister(data);
      setMarks(marksFrom(data));
      setNotice(
        data.session
          ? `Register saved${data.session.recordedBy ? ` by ${data.session.recordedBy.name}` : ''}.`
          : 'Register saved.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the register.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => changeDate(shiftDate(date, -1))}
            disabled={busy}
            aria-label="Previous day"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronLeft size={16} />
          </button>

          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => changeDate(event.target.value)}
            disabled={busy}
            aria-label="Register date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="button"
            onClick={() => changeDate(shiftDate(date, 1))}
            disabled={busy || date >= today}
            aria-label="Next day"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronRight size={16} />
          </button>

          {loading ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Loading...
            </span>
          ) : null}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={markRemainingPresent}
              disabled={busy || counts.unmarked === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ClipboardCheck size={16} />
              Mark remaining present
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save register'}
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      ) : null}

      {readOnlyReason ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {readOnlyReason}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <CountChip
          label="Present"
          value={counts.present}
          className="bg-emerald-50 text-emerald-700"
        />
        <CountChip label="Absent" value={counts.absent} className="bg-red-50 text-red-700" />
        <CountChip label="Late" value={counts.late} className="bg-amber-50 text-amber-700" />
        <CountChip label="Excused" value={counts.excused} className="bg-blue-50 text-blue-700" />
        <CountChip
          label="Unmarked"
          value={counts.unmarked}
          className="bg-slate-100 text-slate-600"
        />
      </div>

      <p className="text-xs text-slate-500">
        {register.session
          ? `Last saved ${formatDate(register.session.updatedAt)}${
              register.session.recordedBy ? ` by ${register.session.recordedBy.name}` : ''
            }.`
          : 'No register saved for this day yet.'}
        {canEdit && dirty ? ' · Unsaved changes' : ''}
      </p>

      {students.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <Users size={28} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No active students in this class
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Enroll students in this class before taking attendance.
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Note</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => {
                const mark = marks[student.studentId] ?? { status: null, note: '' };
                const name = studentFullName(student);

                return (
                  <tr key={student.studentId} className="border-t border-slate-100">
                    <td className="px-3 py-4">
                      <Link
                        href={`/workspaces/${workspaceId}/students/${student.studentId}`}
                        className="font-semibold text-slate-900 transition hover:text-blue-600"
                      >
                        {name}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {student.studentCode ?? 'No student code'}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      {canEdit ? (
                        <div
                          role="group"
                          aria-label={`Attendance for ${name}`}
                          className="flex flex-wrap gap-1.5"
                        >
                          {ATTENDANCE_STATUSES.map((status) => {
                            const selected = mark.status === status;

                            return (
                              <button
                                key={status}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => updateMark(student.studentId, { status })}
                                disabled={busy}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  selected
                                    ? attendanceStatusSelectedClasses[status]
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {attendanceStatusLabels[status]}
                              </button>
                            );
                          })}
                        </div>
                      ) : mark.status ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${attendanceStatusClasses[mark.status]}`}
                        >
                          {attendanceStatusLabels[mark.status]}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          Not marked
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      {canEdit ? (
                        <input
                          value={mark.note}
                          onChange={(event) =>
                            updateMark(student.studentId, { note: event.target.value })
                          }
                          disabled={busy}
                          maxLength={200}
                          placeholder="Optional note"
                          aria-label={`Note for ${name}`}
                          className={inputClass}
                        />
                      ) : (
                        <span className="text-slate-600">{mark.note || '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && counts.unmarked > 0 ? (
        <p className="text-xs text-slate-500">
          {counts.unmarked} {counts.unmarked === 1 ? 'student is' : 'students are'} unmarked and
          will be left blank.
        </p>
      ) : null}
    </div>
  );
}
