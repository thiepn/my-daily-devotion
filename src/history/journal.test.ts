import { afterEach, describe, expect, it, vi } from 'vitest';
import { MddDatabase } from '../data/database';
import type { ActivityEvent, ActivityEventType, Instant, LocalDate, Prayer } from '../domain/types';
import { filterHistoryEvents, groupHistoryEvents, loadHistoryJournal, parseHistoryQuery, withHistoryReturn } from './journal';
import { HistoryRepository } from './repository';
import { loadMcheynePlan } from '../mcheyne/loader';
vi.mock('../mcheyne/loader', () => ({ loadMcheynePlan: vi.fn(async () => ({ assignments: [{ readings: Array.from({ length: 4 }, (_, i) => ({ displayReference: `Genesis ${i + 1}`, group: 'family', references: [{ translationId: 'BSB', startVerseKey: `GEN.${i + 1}.1`, endVerseKey: `GEN.${i + 1}.10` }] })) }] })) }));
const databases: MddDatabase[] = [];
function database() { const db = new MddDatabase(`history-journal-${crypto.randomUUID()}`); databases.push(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
const at = '2026-04-24T08:00:00.000Z' as Instant;
const fields = (id: string) => ({ id, createdAt: at, updatedAt: at, revision: 1, deletedAt: null });
function event(id: string, type: ActivityEventType, date = '2026-04-24', subject = id, metadata = {}): ActivityEvent { return { id, type, localDate: date as LocalDate, occurredAt: at, subjectType: 'fixture', subjectId: subject, metadata, timeZone: 'Pacific/Auckland' }; }
function prayer(id: string): Prayer { return { ...fields(id), body: 'Private prayer wording', status: 'ACTIVE', personId: null, categoryId: null, scheduleId: null, eventDate: null, focusUntil: null, sourceReflectionId: null, sourceDevotionDate: null, lastPrayedAt: null, archivedAt: null }; }
const query = { period: 'this-year' as const, view: 'overview' as const, shown: 5 };
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(table => table.toArray())); }
describe('History journal reads', () => {
  it('counts distinct historical facts independently of segments and removed sources', async () => {
    const db = database(); await db.activityEvents.bulkAdd([event('p1','PRAYER_CREATED','2026-04-24','p'), event('p2','PRAYER_CREATED','2026-04-24','p'), event('r1','REFLECTION_CREATED','2026-04-23','r'), event('old','PRAYER_CREATED','2025-04-24','old')]);
    const all = await loadHistoryJournal(db, query, '2026-04-24');
    expect(all.metrics).toEqual({ days: 2, prayers: 1, reflections: 1 }); expect(all.years).toEqual(['2026','2025']);
    const only = await loadHistoryJournal(db, { ...query, view: 'reflections' }, '2026-04-24'); expect(only.metrics).toEqual(all.metrics); expect(only.total).toBe(1);
    expect((await loadHistoryJournal(db, { ...query, period: 'all' }, '2026-04-24')).metrics.prayers).toBe(2);
  });
  it('groups readings only by date, enrollment and assignment; groups prayed actions by day', () => {
    const reading = (id: string, enrollmentId = 'a', assignmentSequence = 1, date = '2026-04-24') => event(id,'READING_COMPLETED',date,id,{ enrollmentId, assignmentSequence, readingIndex: 0 });
    const rows = groupHistoryEvents([reading('1'),reading('2'),reading('3','b'),reading('4','a',2),reading('5','a',1,'2026-04-23'),event('p1','PRAYER_PRAYED'),event('p2','PRAYER_PRAYED'),event('p3','PRAYER_UPDATED')], 'overview');
    expect(rows.map(r => r.length).sort()).toEqual([1,1,1,1,2,2]);
    expect(groupHistoryEvents(rows.flat(), 'readings')).toHaveLength(4);
    expect(groupHistoryEvents(rows.flat(), 'prayer')).toHaveLength(2);
    expect(groupHistoryEvents(rows.flat(), 'overview', true)).toHaveLength(0);
  });
  it('keeps stored devotional dates across time zones, leap day, and New Year', () => {
    const events = [event('leap','REFLECTION_CREATED','2024-02-29'), event('new','PRAYER_CREATED','2027-01-01'), event('old','PRAYER_CREATED','2026-12-31')];
    expect(filterHistoryEvents(events, query, '2027-01-01').map(e=>e.id)).toEqual(['new']);
    expect(filterHistoryEvents(events, { ...query, period:'2026' }, '2027-01-01').map(e=>e.id)).toEqual(['old']);
    expect(filterHistoryEvents(events, { ...query, period:'2024' }, '2027-01-01')[0]?.localDate).toBe('2024-02-29');
  });
  it('sorts by devotional date, event time and stable ID without mutating input', () => {
    const events = [event('z','PRAYER_CREATED'),event('a','PRAYER_CREATED'),{...event('latest','PRAYER_CREATED'), occurredAt:'2026-04-24T09:00:00.000Z' as Instant},event('backdated','REFLECTION_CREATED','2026-04-23')];
    const before = structuredClone(events); expect(groupHistoryEvents(events,'overview').map(r=>r[0]!.id)).toEqual(['latest','a','z','backdated']); expect(events).toEqual(before);
  });
  it('does not expose tombstoned parents, updates, resolutions or highlights', async () => {
    const db = database(); await db.prayers.add(prayer('p')); await db.prayerUpdates.add({ ...fields('u'), prayerId:'p', type:'update', body:'removed update secret', occurredAt:at, deletedAt:at });
    await db.prayerResolutions.add({ ...fields('answer'), prayerId:'p', answeredAt:at, reflectionMd:'removed answer secret', deletedAt:at });
    await db.highlights.add({ ...fields('h'), translationId:'BSB', startVerseKey:'JHN.3.16', endVerseKey:'JHN.3.16', style:null, deletedAt:at });
    const events = [event('update','PRAYER_UPDATED','2026-04-24','u'),event('answer','PRAYER_ANSWERED','2026-04-24','p',{resolutionId:'answer'}),event('highlight','HIGHLIGHT_CREATED','2026-04-24','h')];
    const entries = await new HistoryRepository(db).resolveEvents(events);
    expect(entries.every(e=>e.body===null && e.fullText===null && e.href===null)).toBe(true); expect(entries[2]?.reference).toBeNull();
    await db.prayerUpdates.update('u',{deletedAt:null}); await db.prayers.update('p',{deletedAt:at});
    expect((await new HistoryRepository(db).resolveEvents([events[0]!]))[0]?.body).toBeNull();
  });
  it('never substitutes a newer answer or prayer body when a recorded resolution is missing', async () => {
    const db = database(); await db.prayers.add(prayer('p')); await db.prayerResolutions.add({ ...fields('current'), prayerId:'p', answeredAt:at, reflectionMd:'new answer' });
    const entry = (await new HistoryRepository(db).resolveEvents([event('e','PRAYER_ANSWERED','2026-04-24','p',{resolutionId:'missing'})]))[0]!;
    expect(entry.body).toBeNull(); expect(entry.href).toBeNull(); expect(entry.availability).toBe('unavailable');
  });
  it('returns full current writing for Day, without changing the original date or recording a read', async () => {
    const db = database(); await db.reflections.add({ ...fields('r'), localDate:'2026-04-23', devotionDayId:'d', bodyMd:'Revised writing. '.repeat(100) }); await db.activityEvents.add(event('e','REFLECTION_CREATED','2026-04-23','r'));
    const before = await snapshot(db); const entries = await new HistoryRepository(db).listDay('2026-04-23');
    expect(entries[0]?.body?.length).toBeLessThan(225); expect(entries[0]?.fullText?.length).toBeGreaterThan(1000); expect(entries[0]?.localDate).toBe('2026-04-23'); expect(await snapshot(db)).toEqual(before);
  });
  it('keeps ordinary requests out of Moments and paginates beyond 200', async () => {
    const db = database(); await db.activityEvents.bulkAdd([...Array.from({length:230},(_,i)=>event(`r${String(i).padStart(3,'0')}`,'REFLECTION_CREATED')),event('p','PRAYER_CREATED'),event('u','PRAYER_UPDATED'),event('a','PRAYER_ANSWERED'),event('h','HIGHLIGHT_CREATED'),event('e','ENCOURAGEMENT_RECORDED')]);
    const first = await loadHistoryJournal(db,{...query,shown:20},'2026-04-24',true), full = await loadHistoryJournal(db,{...query,shown:240},'2026-04-24',true);
    expect(first.rows).toHaveLength(20); expect(full.rows).toHaveLength(233); expect(full.total).toBe(233);
  });
  it('keeps valid reading references and degrades only optional plan details on asset failure', async () => {
    const db = database(), events = [event('a','READING_COMPLETED','2026-04-24','x',{enrollmentId:'plan',assignmentSequence:1,readingIndex:0}),event('b','READING_COMPLETED','2026-04-24','y',{enrollmentId:'plan',assignmentSequence:1,readingIndex:1})]; await db.activityEvents.bulkAdd(events);
    const model = await loadHistoryJournal(db,query,'2026-04-24'); expect(model.rows[0]?.entry.body).toContain('Genesis 1'); expect(model.rows[0]?.entry.body).toContain('Genesis 2');
    vi.mocked(loadMcheynePlan).mockRejectedValueOnce(new Error('offline asset missing'));
    expect((await new HistoryRepository(db).resolveEvents(events))[0]?.title).toBe('Completed reading');
  });
  it('handles 10,000 events with bounded source reads and zero writes', async () => {
    const db = database(); await db.activityEvents.bulkAdd(Array.from({length:10000},(_,i)=>event(`event-${String(i).padStart(5,'0')}`,'PRAYER_CREATED')));
    const bulk = vi.spyOn(db.prayers,'bulkGet'), before = await snapshot(db), start = performance.now();
    const model = await loadHistoryJournal(db,query,'2026-04-24'); expect(model.total).toBe(10000); expect(model.rows).toHaveLength(5); expect(bulk.mock.calls[0]?.[0]).toHaveLength(5); expect(performance.now()-start).toBeLessThan(5000); expect(await snapshot(db)).toEqual(before);
  });
  it('normalizes malformed query values and preserves existing source parameters', () => {
    expect(parseHistoryQuery(new URLSearchParams('period=bad&view=bad&shown=-2'))).toEqual(query);
    expect(parseHistoryQuery(new URLSearchParams(),true).shown).toBe(20);
    const href = withHistoryReturn('/bible/GEN/1?enrollment=e&sequence=1&reading=0','/history?period=2025&view=readings'); expect(href).toContain('enrollment=e'); expect(new URLSearchParams(href.split('?')[1]).get('return')).toBe('/history?period=2025&view=readings');
  });
});
