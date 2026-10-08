import { afterEach, expect, it } from 'vitest';
import { MddDatabase } from '../data/database';
import type { ActivityEvent, Instant } from '../domain/types';
import { loadJournalReview, parseJournalRange, previousCompletedWeek, reviewShown, weekContaining } from './review';
const databases: MddDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
it('defaults to a completed Monday–Sunday week even on Sunday and across New Year', () => {
  expect(previousCompletedWeek('2026-04-24')).toEqual({ from: '2026-04-13', to: '2026-04-19' });
  expect(previousCompletedWeek('2026-04-19')).toEqual({ from: '2026-04-06', to: '2026-04-12' });
  expect(previousCompletedWeek('2026-01-01')).toEqual({ from: '2025-12-22', to: '2025-12-28' });
});
it('uses calendar dates across leap day and daylight-saving boundaries', () => {
  expect(weekContaining('2024-02-29')).toEqual({ from: '2024-02-26', to: '2024-03-03' });
  expect(weekContaining('2026-03-29')).toEqual({ from: '2026-03-23', to: '2026-03-29' });
});
it('rejects malformed, nonexistent, incomplete and reversed ranges', () => {
  for (const [from, to] of [['2026-02-29', '2026-03-01'], ['2026-04-02', '2026-04-01'], [null, '2026-04-01'], ['2026-4-1', '2026-04-02']]) expect(parseJournalRange(from!, to!)).toBeNull();
  expect(parseJournalRange('2024-02-29', '2024-02-29')).toEqual({ from: '2024-02-29', to: '2024-02-29' });
  expect(reviewShown('-1')).toBe(20); expect(reviewShown('240')).toBe(240);
});
it('filters inclusively by stored dates, pages beyond 200, and makes zero database writes', async () => {
  const db = new MddDatabase(`review-${crypto.randomUUID()}`); databases.push(db);
  const at = '2026-01-01T00:10:00.000Z' as Instant;
  const event = (id: string, date: ActivityEvent['localDate']): ActivityEvent => ({ id, localDate: date, type: 'REFLECTION_CREATED', subjectType: 'reflection', subjectId: id, occurredAt: at, timeZone: 'Pacific/Auckland', metadata: {} });
  await db.activityEvents.bulkAdd([event('outside-before', '2026-04-12'), ...Array.from({ length: 230 }, (_, index) => event(`inside-${index}`, index % 2 ? '2026-04-13' : '2026-04-19')), event('outside-after', '2026-04-20')]);
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  const first = await loadJournalReview(db, { from: '2026-04-13', to: '2026-04-19' }, '2027-01-01', 20);
  expect(first.rows).toHaveLength(20); expect(first.total).toBe(230); expect(first.metrics).toEqual({ days: 2, prayers: 0, reflections: 230 });
  const full = await loadJournalReview(db, { from: '2026-04-13', to: '2026-04-19' }, '2027-01-01', 240);
  expect(full.rows).toHaveLength(230); expect(full.rows.every(row => !row.id.startsWith('outside'))).toBe(true);
  expect(full.rows[0]?.entry.availability).toBe('unavailable');
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});
