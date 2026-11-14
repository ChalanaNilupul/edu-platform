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
