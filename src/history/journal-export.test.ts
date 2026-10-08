import { afterEach, expect, it } from 'vitest';
import { MddDatabase } from '../data/database';
import type { ActivityEvent, Reflection } from '../domain/types';
import { loadSelectedJournal, parseJournalSections, selectedJournalMarkdown } from './journal-export';
const databases: MddDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
it('selects explicit sections and treats an empty choice as empty, not defaults', () => {
  expect(parseJournalSections(null)).toHaveLength(5); expect(parseJournalSections('')).toEqual([]);
  expect(parseJournalSections('requests,invalid,reflections,requests')).toEqual(['reflections', 'requests']);
});
it('exports current complete writing by stored dates without limits, private recovery content or writes', async () => {
  const db = new MddDatabase(`journal-export-${crypto.randomUUID()}`); databases.push(db);
  const at = '2025-12-31T23:59:00.000Z';
  const records = Array.from({ length: 231 }, (_, index) => ({ id: `reflection-${index}`, revision: 1, createdAt: at, updatedAt: at, deletedAt: index === 230 ? at : null, localDate: '2026-04-24', devotionDayId: 'day', bodyMd: `Complete writing ${index}\n\n${'A full paragraph. '.repeat(25)}\n<img src="https://example.com/private">\n\`\`\`` } as Reflection));
  await db.reflections.bulkAdd(records);
  const event = (id: string, subjectId: string, localDate: ActivityEvent['localDate'] = '2026-04-24'): ActivityEvent => ({ id, type: 'REFLECTION_CREATED', subjectType: 'reflection', subjectId, localDate, occurredAt: at, timeZone: 'Pacific/Auckland', metadata: {} });
  await db.activityEvents.bulkAdd([...records.map((record, index) => event(`event-${index}`, record.id)), event('duplicate', records[0]!.id), event('outside', 'missing', '2026-04-25'), event('missing', 'missing')]);
  await db.people.add({ id: 'private-person', name: 'Person', relationship: null, notes: 'Private notes excluded', revision: 1, createdAt: at, updatedAt: at, deletedAt: null });
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  const result = await loadSelectedJournal(db, { from: '2026-04-24', to: '2026-04-24' }, ['reflections']);
  expect(result.entries).toHaveLength(230); expect(result.unavailable).toBe(2);
  expect(result.entries.every(entry => entry.localDate === '2026-04-24')).toBe(true);
  const markdown = selectedJournalMarkdown(result);
  expect(markdown).toContain(records[0]!.bodyMd); expect(markdown).toContain('````text');
  expect(markdown).not.toContain('Private notes excluded'); expect(markdown).not.toContain('data.json');
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
  expect((await loadSelectedJournal(db, result.range, [])).entries).toEqual([]);
  await expect(loadSelectedJournal(db, { from: '2026-04-25', to: '2026-04-24' }, ['reflections'])).rejects.toThrow(/valid/);
});
