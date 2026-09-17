import { assertLocalDate, localDateFromParts } from "../domain/time";
import type { LocalDate, Prayer, PrayerSchedule, PrayerScheduleMode } from "../domain/types";

export interface PrayerScheduleDraft {
  mode: PrayerScheduleMode;
  weekdays?: number[];
  intervalDays?: number | null;
  monthlyDay?: number | null;
  onDate?: LocalDate | null;
  anchorDate?: LocalDate | null;
}

export type PrayerScheduleFields = Pick<PrayerSchedule, "mode" | "weekdays" | "intervalDays" | "monthlyDay" | "onDate" | "anchorDate">;
export type EventQueueReason = "event-tomorrow" | "event-today" | "event-follow-up" | null;

function utcDate(localDate: LocalDate): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day));
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000);
}

export function addLocalDays(localDate: LocalDate, days: number): LocalDate {
  const date = utcDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  return localDateFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function isoWeekday(localDate: LocalDate): number {
  const day = utcDate(localDate).getUTCDay();
  return day === 0 ? 7 : day;
}

function daysInMonth(localDate: LocalDate): number {
  const date = utcDate(localDate);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function normalizePrayerScheduleDraft(draft: PrayerScheduleDraft): PrayerScheduleFields {
  const mode = draft.mode;
  if (mode === "ROTATION" || mode === "DAILY" || mode === "MANUAL_ONLY") {
    return { mode, weekdays: [], intervalDays: null, monthlyDay: null, onDate: null, anchorDate: null };
  }
  if (mode === "WEEKDAYS") {
    const weekdays = [...new Set(draft.weekdays ?? [])].sort((a, b) => a - b);
    if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
      throw new Error("Choose at least one weekday, from Monday to Sunday.");
    }
    return { mode, weekdays, intervalDays: null, monthlyDay: null, onDate: null, anchorDate: null };
  }
  if (mode === "INTERVAL_DAYS") {
    const intervalDays = draft.intervalDays ?? 0;
    const anchorDate = draft.anchorDate ?? null;
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 3650) throw new Error("Interval must be between 1 and 3650 days.");
    if (!anchorDate) throw new Error("An interval schedule needs an anchor date.");
    assertLocalDate(anchorDate);
    return { mode, weekdays: [], intervalDays, monthlyDay: null, onDate: null, anchorDate };
  }
  if (mode === "MONTHLY") {
    const monthlyDay = draft.monthlyDay ?? 0;
    if (!Number.isInteger(monthlyDay) || monthlyDay < 1 || monthlyDay > 31) throw new Error("Monthly day must be between 1 and 31.");
    return { mode, weekdays: [], intervalDays: null, monthlyDay, onDate: null, anchorDate: null };
  }
  const onDate = draft.onDate ?? null;
  if (!onDate) throw new Error("A one-date schedule needs a date.");
  assertLocalDate(onDate);
  return { mode, weekdays: [], intervalDays: null, monthlyDay: null, onDate, anchorDate: null };
}

export function isScheduleDue(schedule: PrayerSchedule, localDate: LocalDate): boolean {
  if (schedule.deletedAt || schedule.mode === "ROTATION" || schedule.mode === "MANUAL_ONLY") return false;
  if (schedule.mode === "DAILY") return true;
  if (schedule.mode === "WEEKDAYS") return schedule.weekdays.includes(isoWeekday(localDate));
  if (schedule.mode === "INTERVAL_DAYS") {
    if (!schedule.anchorDate || !schedule.intervalDays) return false;
    const elapsed = daysBetween(schedule.anchorDate, localDate);
    return elapsed >= 0 && elapsed % schedule.intervalDays === 0;
  }
  if (schedule.mode === "MONTHLY") {
    if (!schedule.monthlyDay) return false;
    const day = Number(localDate.slice(8, 10));
    return day === Math.min(schedule.monthlyDay, daysInMonth(localDate));
  }
  return schedule.onDate === localDate;
}

export function isFocusActive(prayer: Prayer, localDate: LocalDate): boolean {
  return prayer.focusUntil !== null && prayer.focusUntil >= localDate;
}

export function eventQueueReason(prayer: Prayer, localDate: LocalDate): EventQueueReason {
  if (!prayer.eventDate) return null;
  const until = daysBetween(localDate, prayer.eventDate);
  if (until === 1) return "event-tomorrow";
  if (until === 0) return "event-today";
  if (until === -1) return "event-follow-up";
  return null;
}

export function scheduleLabel(schedule: PrayerSchedule | null): string {
  if (!schedule || schedule.mode === "ROTATION") return "Normal rotation";
  if (schedule.mode === "DAILY") return "Daily";
  if (schedule.mode === "WEEKDAYS") {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return `Every ${schedule.weekdays.map((day) => days[day - 1]).join(", ")}`;
  }
  if (schedule.mode === "INTERVAL_DAYS") return `Every ${schedule.intervalDays} days`;
  if (schedule.mode === "MONTHLY") return `Monthly · day ${schedule.monthlyDay}`;
  if (schedule.mode === "ON_DATE") return `One date · ${schedule.onDate}`;
  return "Manual only";
}
