import { afterEach, expect, it } from 'vitest';
import { MddDatabase } from '../data/database';
import type { ActivityEvent, Reflection } from '../domain/types';
import { loadAnniversaries } from './remember';
import { backupReminderDue, nextReminderMonth, readRememberPreferences, updateRememberPreferences } from './remember-preferences';
const databases: MddDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
it('keeps pristine reads write-free and distinguishes unavailable preferences from opted-out choices', () => {
  let raw: string | null = null, writes = 0;
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; writes++; } };
  expect(readRememberPreferences(storage).value?.anniversaries).toBe(false); expect(writes).toBe(0);
  expect(updateRememberPreferences(current => ({ ...current, anniversaries: true }), storage).value?.anniversaries).toBe(true); expect(writes).toBe(1);
  expect(readRememberPreferences({ getItem: () => '{"version":2}' }).status).toBe('unavailable');
  expect(updateRememberPreferences(current => current, { getItem: () => raw, setItem: () => { throw Error('Full'); } }).status).toBe('unavailable');
});
it('uses calendar months, respects generation receipts and does not claim externally retained backups', () => {
  expect(nextReminderMonth('2024-01-31')).toBe('2024-02-29'); expect(nextReminderMonth('2026-01-31')).toBe('2026-02-28'); expect(nextReminderMonth('2026-12-20')).toBe('2027-01-20');
  const choices = { version: 1 as const, anniversaries: false, dismissedDates: [], backupReminder: { next: '2026-04-24' as const } };
  expect(backupReminderDue(choices, { status: 'unavailable', receipt: null }, '2026-04-24')).toBe(true);
  expect(backupReminderDue(choices, { status: 'available', receipt: { version: 1, kind: 'encrypted', generatedAt: '2026-04-23T07:00:00Z' } }, '2026-04-24')).toBe(false);
  expect(backupReminderDue({ ...choices, backupReminder: null }, { status: 'available', receipt: null }, '2030-01-01')).toBe(false);
});
it('uses exact earlier-year stored dates, omits leap-day substitutes and removed sources, and writes nothing', async () => {
  const db = new MddDatabase(`anniversary-${crypto.randomUUID()}`); databases.push(db);
  const at = '2026-01-01T00:00:00Z';
  const record = (id: string, deletedAt: Reflection['deletedAt'] = null): Reflection => ({ id, deletedAt, revision: 1, createdAt: at, updatedAt: at, localDate: '2024-02-29', devotionDayId: 'day', bodyMd: 'Actual saved words' });
  await db.reflections.bulkAdd([record('alive'), record('removed', at)]);
  const event = (id: string, subjectId: string, localDate: ActivityEvent['localDate']): ActivityEvent => ({ id, subjectId, localDate, occurredAt: at, subjectType: 'reflection', type: 'REFLECTION_CREATED', metadata: {}, timeZone: 'Pacific/Auckland' });
  await db.activityEvents.bulkAdd([event('leap','alive','2024-02-29'), event('removed','removed','2024-02-29'), event('current','alive','2028-02-29'), event('substitute','alive','2025-02-28')]);
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  expect((await loadAnniversaries(db, '2028-02-29', 20)).entries.map(entry => entry.id)).toEqual(['leap']);
  expect((await loadAnniversaries(db, '2026-03-01', 20)).total).toBe(0);
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});
