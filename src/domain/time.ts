import type { Instant, LocalDate, TimeZoneId } from "./types";

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertLocalDate(value: string): asserts value is LocalDate {
  if (!LOCAL_DATE.test(value)) throw new Error(`Invalid LocalDate: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year!, month! - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
}

export function assertInstant(value: string): asserts value is Instant {
  if (!value.endsWith("Z") || Number.isNaN(Date.parse(value))) throw new Error(`Invalid UTC instant: ${value}`);
}

export function currentTimeZone(): TimeZoneId {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function localDateFromParts(year: number, month: number, day: number): LocalDate {
  const value = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}` as LocalDate;
  assertLocalDate(value);
  return value;
}

export function localDateInTimeZone(now: Date | Instant, timeZone: TimeZoneId): LocalDate {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid instant for local date conversion.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return localDateFromParts(Number(value.year), Number(value.month), Number(value.day));
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return localDateFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
