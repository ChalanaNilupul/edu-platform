'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, Clock, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { ApiError, apiFetch } from '@/lib/api';
import {
  DAYS_OF_WEEK,
  dayOfWeekLabels,
  minutesToTime,
  slotTimeLabel,
  slotTeacherName,
  timeToMinutes,
  type ClassScheduleSlot,
  type DayOfWeek,
} from '@/lib/schedule';
import type { SubjectRecord } from '@/lib/subjects';
import { teacherName, type TeacherRecord } from '@/lib/teachers';

type ClassScheduleManagerProps = {
  workspaceId: string;
  classId: string;
  canManage: boolean;
  slots: ClassScheduleSlot[];
  subjects: SubjectRecord[];
  teachers: TeacherRecord[];
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function ClassScheduleManager({
  workspaceId,
  classId,
  canManage,
  slots,
  subjects,
  teachers,
}: ClassScheduleManagerProps) {
  const router = useRouter();
  const schedulableSubjects = subjects.filter((subject) => subject.status === 'ACTIVE');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('MONDAY');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [subjectId, setSubjectId] = useState(schedulableSubjects[0]?.id ?? '');
  const [membershipId, setMembershipId] = useState('');
  const [room, setRoom] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function resetForm() {
    setEditingId(null);
    setDayOfWeek('MONDAY');
    setStart('09:00');
    setEnd('10:00');
    setSubjectId(schedulableSubjects[0]?.id ?? '');
    setMembershipId('');
    setRoom('');
    setError('');
  }

  function startEdit(slot: ClassScheduleSlot) {
    setEditingId(slot.id);
    setDayOfWeek(slot.dayOfWeek);
    setStart(minutesToTime(slot.startMinutes));
    setEnd(minutesToTime(slot.endMinutes));
    setSubjectId(slot.subjectId);
    setMembershipId(slot.membershipId ?? '');
    setRoom(slot.room ?? '');
    setError('');
  }

  async function saveSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes === null || endMinutes === null) {
      setError('Choose a valid start and end time.');
      return;
    }

    if (endMinutes <= startMinutes) {
      setError('End time must be after start time.');
      return;
    }

    if (!subjectId) {
      setError('Choose a subject for this slot.');
      return;
    }

    setSaving(true);
    setError('');

    const body = {
      subjectId,
      membershipId: membershipId || null,
      dayOfWeek,
      startMinutes,
      endMinutes,
      room: room.trim() || null,
    };

    try {
      if (editingId) {
        await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/schedule/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/schedule`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save the slot.');
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(slot: ClassScheduleSlot) {
    const confirmed = window.confirm(
      `Remove ${slot.subject.name} from ${dayOfWeekLabels[slot.dayOfWeek]} ${slotTimeLabel(slot)}?`,
    );

    if (!confirmed) {
      return;
    }

    setPendingDeleteId(slot.id);
    setError('');

    try {
      await apiFetch(`/workspaces/${workspaceId}/classes/${classId}/schedule/${slot.id}`, {
        method: 'DELETE',
      });

      if (editingId === slot.id) {
        resetForm();
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to remove the slot.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  const grouped = DAYS_OF_WEEK.map((day) => ({
    day,
    items: slots.filter((slot) => slot.dayOfWeek === day),
  })).filter((group) => group.items.length > 0);

  const formBusy = saving;
  const actionsLocked = saving || pendingDeleteId !== null;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {canManage ? (
        schedulableSubjects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
            Link an active subject to this class before adding timetable slots.
          </p>
        ) : (
          <form onSubmit={saveSlot} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit slot' : 'Add a slot'}
              </h3>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                >
                  <X size={14} />
                  Cancel edit
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label htmlFor="scheduleDay" className="text-xs font-medium text-slate-600">
                  Day
                </label>
                <select
                  id="scheduleDay"
                  value={dayOfWeek}
                  onChange={(event) => setDayOfWeek(event.target.value as DayOfWeek)}
                  className={`mt-1 ${inputClass}`}
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <option key={day} value={day}>
                      {dayOfWeekLabels[day]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scheduleStart" className="text-xs font-medium text-slate-600">
                  Start
                </label>
                <input
                  id="scheduleStart"
                  type="time"
                  step={900}
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              <div>
                <label htmlFor="scheduleEnd" className="text-xs font-medium text-slate-600">
                  End
                </label>
                <input
                  id="scheduleEnd"
                  type="time"
                  step={900}
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              <div>
                <label htmlFor="scheduleSubject" className="text-xs font-medium text-slate-600">
                  Subject
                </label>
                <select
                  id="scheduleSubject"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">Choose a subject</option>
                  {schedulableSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scheduleTeacher" className="text-xs font-medium text-slate-600">
                  Teacher (optional)
                </label>
                <select
                  id="scheduleTeacher"
                  value={membershipId}
                  onChange={(event) => setMembershipId(event.target.value)}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">No teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacherName(teacher)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scheduleRoom" className="text-xs font-medium text-slate-600">
                  Room (optional)
                </label>
                <input
                  id="scheduleRoom"
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  maxLength={80}
                  placeholder="e.g. Room 12"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={formBusy}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {formBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editingId ? (
                  <Pencil size={16} />
                ) : (
                  <Plus size={16} />
                )}
                {formBusy ? 'Saving...' : editingId ? 'Update slot' : 'Add slot'}
              </button>
              <p className="text-xs text-slate-500">
                Slots cannot overlap for the same class or teacher.
              </p>
            </div>
          </form>
        )
      ) : null}

      {grouped.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
          <CalendarDays size={28} className="text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">No timetable slots yet</p>
          <p className="mt-1 text-xs text-slate-500">
            {canManage
              ? 'Add the weekly periods for this class.'
              : 'A manager has not published a timetable for this class yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.day} className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {dayOfWeekLabels[group.day]}
                </h3>
                <span className="text-xs font-medium text-slate-500">
                  {group.items.length} slots
                </span>
              </div>

              <ul className="divide-y divide-slate-100">
                {group.items.map((slot) => (
                  <li
                    key={slot.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        <Clock size={14} />
                        {slotTimeLabel(slot)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {slot.subject.name}
                          {slot.subject.code ? (
                            <span className="ml-2 text-xs font-semibold text-slate-400">
                              {slot.subject.code}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {slotTeacherName(slot)}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </p>
                      </div>
                    </div>

                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
                        <button
                          type="button"
                          onClick={() => startEdit(slot)}
                          disabled={actionsLocked}
                          className="inline-flex items-center gap-1.5 text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlot(slot)}
                          disabled={actionsLocked}
                          className="inline-flex items-center gap-1.5 text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingDeleteId === slot.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
