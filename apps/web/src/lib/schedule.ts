export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const dayOfWeekLabels: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export type ClassScheduleSlot = {
  id: string;
  classId: string;
  subjectId: string;
  membershipId: string | null;
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
  createdAt: string;
  updatedAt: string;
  subject: {
    id: string;
    name: string;
    code: string | null;
  };
  membership: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string | null;
    };
  } | null;
};

export type ClassScheduleListResponse = {
  items: ClassScheduleSlot[];
};

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function timeToMinutes(value: string): number | null {
  const [hoursPart, minutesPart] = value.split(':');
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);

  if (
    hoursPart === undefined ||
    minutesPart === undefined ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 24 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function slotTimeLabel(slot: Pick<ClassScheduleSlot, 'startMinutes' | 'endMinutes'>) {
  return `${minutesToTime(slot.startMinutes)} – ${minutesToTime(slot.endMinutes)}`;
}

export function slotTeacherName(slot: Pick<ClassScheduleSlot, 'membership'>) {
  if (!slot.membership) {
    return 'No teacher assigned';
  }

  return [slot.membership.user.firstName, slot.membership.user.lastName].filter(Boolean).join(' ');
}
