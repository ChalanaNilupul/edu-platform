'use client';

import { Loader2 } from 'lucide-react';

import {
  SUMMARY_RANGE_PRESETS,
  attendanceRateClasses,
  formatAttendanceRate,
  type AttendanceSummaryCounts,
} from '@/lib/attendance';

const dateInputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

type AttendanceRangeControlsProps = {
  from: string;
  to: string;
  today: string;
  loading: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPreset: (days: number) => void;
  onApply: () => void;
};

export function AttendanceRangeControls({
  from,
  to,
  today,
  loading,
  onFromChange,
  onToChange,
  onPreset,
  onApply,
}: AttendanceRangeControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        From
        <input
          type="date"
          value={from}
          max={to || today}
          onChange={(event) => onFromChange(event.target.value)}
          disabled={loading}
          className={dateInputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          max={today}
          onChange={(event) => onToChange(event.target.value)}
          disabled={loading}
          className={dateInputClass}
        />
      </label>

      <div className="flex flex-wrap items-center gap-1.5">
        {SUMMARY_RANGE_PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onPreset(days)}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Last {days} days
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        Apply
      </button>
    </div>
  );
}

export function AttendanceCountChips({ counts }: { counts: AttendanceSummaryCounts }) {
  const entries: Array<[string, number, string]> = [
    ['Present', counts.present, 'bg-emerald-50 text-emerald-700'],
    ['Absent', counts.absent, 'bg-red-50 text-red-700'],
    ['Late', counts.late, 'bg-amber-50 text-amber-700'],
    ['Excused', counts.excused, 'bg-blue-50 text-blue-700'],
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(([label, value, className]) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
        >
          {label}
          <span className="rounded-full bg-white/60 px-1.5">{value}</span>
        </span>
      ))}
    </div>
  );
}

export function AttendanceRateBadge({ rate }: { rate: number | null }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${attendanceRateClasses(rate)}`}
    >
      {formatAttendanceRate(rate)}
    </span>
  );
}
