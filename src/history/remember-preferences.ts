import type { LocalDate } from '../domain/types';
import { validJournalDate } from './review';
import type { ReceiptState } from '../data/backup-receipt';
export const REMEMBER_PREFERENCES_KEY = 'mdd-remember-choices-v1';
export const REMEMBER_CHANGED = 'mdd-remember-choices-changed';
export interface RememberPreferences { version: 1; anniversaries: boolean; dismissedDates: LocalDate[]; backupReminder: { next: LocalDate } | null; }
export type RememberState = { status: 'available'; value: RememberPreferences } | { status: 'unavailable'; value: null };
const empty = (): RememberPreferences => ({ version: 1, anniversaries: false, dismissedDates: [], backupReminder: null });
/** Small device choices only; no writing, events, keys or portable backup data. */
export function readRememberPreferences(storage?: Pick<Storage, 'getItem'>): RememberState {
  try {
    const raw = (storage ?? localStorage).getItem(REMEMBER_PREFERENCES_KEY);
    if (!raw) return { status: 'available', value: empty() };
    const value = JSON.parse(raw) as RememberPreferences;
    if (!value || value.version !== 1 || typeof value.anniversaries !== 'boolean' || !Array.isArray(value.dismissedDates) || value.dismissedDates.length > 60 || !value.dismissedDates.every(validJournalDate) || value.backupReminder !== null && (!value.backupReminder || !validJournalDate(value.backupReminder.next))) throw new Error('Invalid remembering choices');
    return { status: 'available', value: { version: 1, anniversaries: value.anniversaries, dismissedDates: [...value.dismissedDates], backupReminder: value.backupReminder ? { next: value.backupReminder.next } : null } };
  } catch { return { status: 'unavailable', value: null }; }
}
export function updateRememberPreferences(change: (current: RememberPreferences) => RememberPreferences, storage?: Pick<Storage, 'getItem' | 'setItem'>): RememberState {
  const current = readRememberPreferences(storage); if (current.status === 'unavailable') return current;
  try {
    const value = change(current.value); (storage ?? localStorage).setItem(REMEMBER_PREFERENCES_KEY, JSON.stringify(value));
    if (!storage && typeof window !== 'undefined') window.dispatchEvent(new Event(REMEMBER_CHANGED));
    return { status: 'available', value };
  } catch { return { status: 'unavailable', value: null }; }
}
export function nextReminderMonth(date: LocalDate): LocalDate {
  if (!validJournalDate(date)) throw new Error('Invalid reminder date.');
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month!, 1, 12));
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0, 12)).getUTCDate();
  next.setUTCDate(Math.min(day!, last)); return next.toISOString().slice(0, 10) as LocalDate;
}
export function backupReminderDue(value: RememberPreferences, receipt: ReceiptState, today: LocalDate): boolean {
  if (!value.backupReminder) return false;
  let next = value.backupReminder.next;
  if (receipt.receipt) {
    const generated = new Date(receipt.receipt.generatedAt);
    const date = `${generated.getFullYear()}-${String(generated.getMonth()+1).padStart(2,'0')}-${String(generated.getDate()).padStart(2,'0')}` as LocalDate;
    if (validJournalDate(date)) next = [next, nextReminderMonth(date)].sort().at(-1)!;
  }
  return today >= next;
}
