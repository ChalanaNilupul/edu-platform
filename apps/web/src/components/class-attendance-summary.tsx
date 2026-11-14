'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Users } from 'lucide-react';

import {
  AttendanceCountChips,
  AttendanceRangeControls,
  AttendanceRateBadge,
} from '@/components/attendance-summary-shared';
import { ApiError, apiFetch } from '@/lib/api';
import { lastNDays, type ClassAttendanceSummaryResponse } from '@/lib/attendance';
import { studentFullName } from '@/lib/student';

type ClassAttendanceSummaryProps = {
  workspaceId: string;
  classId: string;
  today: string;
  initial: ClassAttendanceSummaryResponse;
};

export function ClassAttendanceSummary({
  workspaceId,
  classId,
  today,
  initial,
}: ClassAttendanceSummaryProps) {
  const [summary, setSummary] = useState(initial);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) {
      setError('Choose both a start and an end date.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch<ClassAttendanceSummaryResponse>(
        `/workspaces/${workspaceId}/classes/${classId}/attendance/summary?from=${nextFrom}&to=${nextTo}`,
      );

      setSummary(data);
      setFrom(data.from);
      setTo(data.to);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load the attendance summary.');
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(days: number) {
    const range = lastNDays(today, days);

    setFrom(range.from);
    setTo(range.to);
    void load(range.from, range.to);
  }

  return (
    <div className="space-y-4">
      <AttendanceRangeControls
        from={from}
        to={to}
        today={today}
        loading={loading}
        onFromChange={setFrom}
        onToChange={setTo}
        onPreset={applyPreset}
        onApply={() => void load(from, to)}
      />

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {summary.sessions} {summary.sessions === 1 ? 'session' : 'sessions'} ·{' '}
            {summary.attended} attended
          </p>
          <div className="mt-2">
            <AttendanceCountChips counts={summary.counts} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Class rate
          </span>
          <span className="text-lg">
            <AttendanceRateBadge rate={summary.rate} />
          </span>
        </div>
      </div>

      {summary.students.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <Users size={28} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">Nobody to summarise yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Enroll students and save a register to see attendance rates.
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Sessions</th>
                <th className="px-3 py-3">Present</th>
                <th className="px-3 py-3">Absent</th>
                <th className="px-3 py-3">Late</th>
                <th className="px-3 py-3">Excused</th>
                <th className="px-3 py-3">Rate</th>
              </tr>
            </thead>

            <tbody>
              {summary.students.map((student) => (
                <tr key={student.studentId} className="border-t border-slate-100">
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/workspaces/${workspaceId}/students/${student.studentId}`}
                        className="font-semibold text-slate-900 transition hover:text-blue-600"
                      >
                        {studentFullName(student)}
                      </Link>
                      {student.active ? null : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          Left class
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {student.studentCode ?? 'No student code'}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-slate-700">{student.sessions}</td>
                  <td className="px-3 py-4 text-emerald-700">{student.counts.present}</td>
                  <td className="px-3 py-4 text-red-700">{student.counts.absent}</td>
                  <td className="px-3 py-4 text-amber-700">{student.counts.late}</td>
                  <td className="px-3 py-4 text-blue-700">{student.counts.excused}</td>
                  <td className="px-3 py-4">
                    <AttendanceRateBadge rate={student.rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Present and late marks count as attended. Excused and unmarked sessions are left out of the
        rate.
      </p>
    </div>
  );
}
