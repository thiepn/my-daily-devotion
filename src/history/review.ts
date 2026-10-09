import { assertLocalDate } from '../domain/time';
import type { LocalDate } from '../domain/types';
import type { MddDatabase } from '../data/database';
import { loadHistoryJournal, type HistoryJournal } from './journal';

export interface JournalDateRange { from: LocalDate; to: LocalDate; }
export function validJournalDate(value: string | null): value is LocalDate {
  if (!value) return false;
  try { assertLocalDate(value); return true; } catch { return false; }
}
// Calendar arithmetic uses UTC only as a date container, never to convert the
// devotional date or an event timestamp into a different day.
export function moveJournalDate(value: LocalDate, days: number): LocalDate {
  assertLocalDate(value);
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  assertLocalDate(result);
  return result;
}
export function weekContaining(value: LocalDate): JournalDateRange {
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  const from = moveJournalDate(value, -((weekday + 6) % 7));
  return { from, to: moveJournalDate(from, 6) };
}
export function previousCompletedWeek(today: LocalDate): JournalDateRange {
  return weekContaining(moveJournalDate(weekContaining(today).from, -1));
}
export function parseJournalRange(from: string | null, to: string | null): JournalDateRange | null {
  return validJournalDate(from) && validJournalDate(to) && from <= to ? { from, to } : null;
}
export function reviewShown(value: string | null): number {
  const number = Number(value ?? 20);
  return Number.isSafeInteger(number) && number >= 20 ? number : 20;
}
export async function loadJournalReview(db: MddDatabase, range: JournalDateRange, today: LocalDate, shown: number): Promise<HistoryJournal> {
  if (!parseJournalRange(range.from, range.to)) throw new Error('Choose a valid inclusive date range.');
  return loadHistoryJournal(db, { period: 'all', view: 'overview', shown }, today, false, range);
}
