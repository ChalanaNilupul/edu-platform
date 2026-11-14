import type { ClassStatus } from './classes';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
};

export const attendanceStatusClasses: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  ABSENT: 'bg-red-50 text-red-700',
  LATE: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-blue-50 text-blue-700',
};

export const attendanceStatusSelectedClasses: Record<AttendanceStatus, string> = {
  PRESENT: 'border-emerald-600 bg-emerald-600 text-white',
  ABSENT: 'border-red-600 bg-red-600 text-white',
  LATE: 'border-amber-500 bg-amber-500 text-white',
  EXCUSED: 'border-blue-600 bg-blue-600 text-white',
};

export type AttendanceStudentRecord = {
  studentId: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
  status: AttendanceStatus | null;
  note: string | null;
};

export type AttendanceSessionRecord = {
  id: string;
  classId: string;
  date: string;
  recordedBy: { membershipId: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
};

export type AttendanceRegisterResponse = {
  date: string;
  session: AttendanceSessionRecord | null;
  students: AttendanceStudentRecord[];
  counts: AttendanceCounts;
};

export type AttendanceSummaryCounts = {
  present: number;
  absent: number;
  late: number;
  excused: number;
};

export type AttendanceSummaryTotals = {
  sessions: number;
  counts: AttendanceSummaryCounts;
  attended: number;
  rate: number | null;
};

export type ClassAttendanceSummaryRow = AttendanceSummaryTotals & {
  studentId: string;
  studentCode: string | null;
  firstName: string;
  lastName: string | null;
  active: boolean;
};

export type ClassAttendanceSummaryResponse = AttendanceSummaryTotals & {
  classId: string;
  from: string;
  to: string;
  students: ClassAttendanceSummaryRow[];
};

export type StudentAttendanceSummaryRow = AttendanceSummaryTotals & {
  classId: string;
  className: string;
  classStatus: ClassStatus;
};

export type StudentAttendanceSummaryResponse = AttendanceSummaryTotals & {
  studentId: string;
  from: string;
  to: string;
  classes: StudentAttendanceSummaryRow[];
};

export type AttendanceOverviewRow = {
  classId: string;
  name: string;
  grade: string | null;
  enrolledCount: number;
  session: {
    id: string;
    recordedBy: { membershipId: string; name: string } | null;
    updatedAt: string;
  } | null;
  counts: AttendanceCounts | null;
};

export type AttendanceOverviewResponse = {
  date: string;
  totals: { classes: number; saved: number; missing: number };
  classes: AttendanceOverviewRow[];
};

export const SUMMARY_RANGE_PRESETS = [7, 30, 90] as const;

// The app formats dates in Colombo time, so "today" follows the same zone.
const DATE_INPUT_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInColombo(): string {
  return DATE_INPUT_FORMATTER.format(new Date());
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function shiftCalendarDate(date: string, days: number): string {
  const parts = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(parts[0] ?? 1970, (parts[1] ?? 1) - 1, (parts[2] ?? 1) + days));

  return shifted.toISOString().slice(0, 10);
}

// The API returns an inclusive range, so 30 days back is today minus 29.
export function lastNDays(today: string, days: number): { from: string; to: string } {
  return { from: shiftCalendarDate(today, -(days - 1)), to: today };
}

export function formatAttendanceRate(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

export function attendanceRateClasses(rate: number | null): string {
  if (rate === null) {
    return 'bg-slate-100 text-slate-500';
  }

  if (rate >= 90) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (rate >= 75) {
    return 'bg-blue-50 text-blue-700';
  }

  if (rate >= 50) {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-red-50 text-red-700';
}

export function tallyAttendance(
  students: Pick<AttendanceStudentRecord, 'status'>[],
): AttendanceCounts {
  const counts: AttendanceCounts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };

  for (const student of students) {
    switch (student.status) {
      case 'PRESENT':
        counts.present += 1;
        break;
      case 'ABSENT':
        counts.absent += 1;
        break;
      case 'LATE':
        counts.late += 1;
        break;
      case 'EXCUSED':
        counts.excused += 1;
        break;
      default:
        counts.unmarked += 1;
    }
  }

  return counts;
}
