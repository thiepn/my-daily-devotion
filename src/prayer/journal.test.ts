import { afterEach, describe, expect, it } from 'vitest';
import { MddDatabase, prepareDatabase } from '../data/database';
import { PrayerRepository } from '../data/repositories/prayers';
import { PrayerSessionRepository } from '../data/repositories/prayer-sessions';
import { PersonRepository } from '../data/repositories/prayer-metadata';
import { loadPrayerFocus, loadPrayerLibrary, personInitials, prayerFilters } from './journal';
import type { LocalDate, TimeZoneId } from '../domain/types';

const date = '2026-04-24' as LocalDate;
const zone = 'Europe/Berlin' as TimeZoneId;
const databases: MddDatabase[] = [];
async function setup() { const db = new MddDatabase(`journal-${crypto.randomUUID()}`); databases.push(db); await prepareDatabase(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(table => table.toArray())); }

describe('Prayer journal read model', () => {
  it('does not initialize categories, sessions or history while browsing an empty library', async () => {
    const db = await setup(); const before = await snapshot(db);
    expect((await loadPrayerLibrary(db)).prayers).toEqual([]);
    expect((await loadPrayerFocus(db, date, zone)).prayer).toBeNull();
    expect(await snapshot(db)).toEqual(before);
  });
  it('shows the real queue request and never writes previews', async () => {
    const db = await setup(); const prayers = new PrayerRepository(db);
    const prayer = await prayers.createPrayer({ body: 'Wisdom' });
    const before = await snapshot(db);
    expect((await loadPrayerFocus(db, date, zone)).prayer?.id).toBe(prayer.id);
    await loadPrayerLibrary(db); expect(await snapshot(db)).toEqual(before);
  });
  it('keeps manual-only requests in the library but outside the preview', async () => {
    const db = await setup(); const prayers = new PrayerRepository(db);
    await prayers.createPrayer({ body: 'Manual', schedule: { mode: 'MANUAL_ONLY', weekdays: [], intervalDays: null, monthlyDay: null, onDate: null, anchorDate: null } });
    expect((await loadPrayerLibrary(db)).counts.ACTIVE).toBe(1);
    expect((await loadPrayerFocus(db, date, zone)).prayer).toBeNull();
  });
  it('previews saved order, skipping removed or answered requests without reconciling items', async () => {
    const db = await setup(); const prayers = new PrayerRepository(db);
    for (let i = 0; i < 3; i++) await prayers.createPrayer({ body: `Request ${i}` });
    const state = (await new PrayerSessionRepository(db).startOrResume('regular', date))!;
    await prayers.answer(state.entries[0]!.prayer!.id, 'Answered');
    await db.prayers.update(state.entries[1]!.prayer!.id, { deletedAt: '2026-04-24T06:00:00.000Z' });
    const before = await snapshot(db); const focus = await loadPrayerFocus(db, date, zone);
    expect(focus.prayer?.id).toBe(state.entries[2]!.prayer!.id);
    expect(focus.session?.depth).toBe('regular'); expect(await snapshot(db)).toEqual(before);
  });
  it('offers explicit reconciliation when a saved session has no active entries', async () => {
    const db = await setup(); const prayers = new PrayerRepository(db);
    const p = await prayers.createPrayer({ body: 'A request' });
    const session = (await new PrayerSessionRepository(db).startOrResume('quick', date))!.session;
    await prayers.answer(p.id, null); const before = await snapshot(db);
    expect(await loadPrayerFocus(db, date, zone)).toMatchObject({ prayer: null, session: { id: session.id } });
    expect(await snapshot(db)).toEqual(before);
  });
  it('does not close yesterday’s session while previewing a new day', async () => {
    const db = await setup(); await new PrayerRepository(db).createPrayer({ body: 'A request' });
    await new PrayerSessionRepository(db).startOrResume('quick', '2026-04-23' as LocalDate);
    const before = await snapshot(db); expect((await loadPrayerFocus(db, date, zone)).session).toBeNull();
    expect(await snapshot(db)).toEqual(before);
  });
  it('validates filters against undeleted metadata and retains global status counts', async () => {
    const db = await setup(); const person = await new PersonRepository(db).createPerson('Anna Maria');
    const prayers = new PrayerRepository(db); await prayers.createPrayer({ body: 'One', personId: person.id });
    const second = await prayers.createPrayer({ body: 'Two' }); await prayers.answer(second.id, null);
    const library = await loadPrayerLibrary(db);
    expect(prayerFilters(new URLSearchParams({ status: 'answered', person: person.id, category: 'missing' }), library)).toEqual({ status: 'ANSWERED', person: person.id, category: '' });
    expect(library.counts).toEqual({ ACTIVE: 1, WAITING: 0, ANSWERED: 1, ARCHIVED: 0 });
    await db.people.update(person.id, { deletedAt: '2026-04-24T06:00:00.000Z' });
    expect(prayerFilters(new URLSearchParams({ person: person.id }), await loadPrayerLibrary(db)).person).toBe('');
  });
  it('derives initials without fabricating names', () => {
    expect(personInitials('  Anna   Maria Jones ')).toBe('AJ');
    expect(personInitials('Miriam')).toBe('M'); expect(personInitials('李 明')).toBe('李明');
  });
});
