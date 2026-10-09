import { afterEach, describe, expect, it } from 'vitest';
import { MddDatabase, prepareDatabase } from '../data/database';
import { newMutableFields } from '../domain/identity';
import { PrayerRepository } from '../data/repositories/prayers';
import { CollectionRepository } from '../data/repositories/collections';
import { searchPersonalPages } from './personal';
import { matchingRanges, matchExcerpt } from './text';
import { parseSearchQuery, savedPassageUrl, withSearchReturn } from './context';
import { readCollection, readSavedScripture, parseSavedQuery } from '../scripture/saved-model';
const databases: MddDatabase[] = [];
async function database() { const db = new MddDatabase('search-release-' + crypto.randomUUID()); databases.push(db); await prepareDatabase(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
const reference = { translationId: 'BSB', startVerseKey: 'JHN.3.16' as const, endVerseKey: 'JHN.3.18' as const };
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(async table => [table.name, await table.toArray()])); }
describe('archive discovery', () => {
 it('pages beyond 200 matches, preserves deterministic ordering, and makes zero writes', async () => {
  const db = await database(); const repo = new PrayerRepository(db); const sample = await repo.createPrayer({body: 'Remember patience'});
  await db.prayers.bulkAdd(Array.from({length: 240}, (_, i) => ({...sample, id: 'prayer-' + String(i).padStart(3, '0')})));
  const before = await snapshot(db), first = await searchPersonalPages(db, 'patience', {shown: {prayers: 10}}), full = await searchPersonalPages(db, 'patience', {shown: {prayers: 300}});
  expect(first.prayers.total).toBe(241); expect(first.prayers.items).toHaveLength(10); expect(full.prayers.items).toHaveLength(241);
  expect(full.prayers.items.slice(0, 10)).toEqual(first.prayers.items); expect(await snapshot(db)).toEqual(before);
 });
 it('keeps private person notes opt-in and opens the selected person', async () => {
  const db = await database(), person = {...newMutableFields(), name: 'Mária Kim', relationship: 'Friend', notes: 'Private outreach note'}; await db.people.add(person);
  expect((await searchPersonalPages(db, 'outreach')).people.total).toBe(0);
  expect((await searchPersonalPages(db, 'outreach', {includePersonNotes: true})).people.items[0]!.href).toBe('/prayer/people?entry=' + person.id);
  const match = (await searchPersonalPages(db, 'maria')).people.items[0]!; expect(match.excerpt).not.toContain('Private');
 });
 it('checks parent and child tombstones and targets exact collection notes', async () => {
  const db = await database(), repo = new CollectionRepository(db), parent = await repo.create('Promises');
  const item = await repo.addReference(parent.id, reference, 'Remember grace');
  const found = (await searchPersonalPages(db, 'grace')).saved.items[0]!;
  expect(new URL(found.href, 'https://local').searchParams.get('item')).toBe(item.id);
  await repo.removeCollection(parent.id); expect((await searchPersonalPages(db, 'grace')).saved.total).toBe(0);
 });
 it('lists live bookmarks, highlights, notes and collections without mutation', async () => {
  const db = await database(); await db.bookmarks.add({...newMutableFields(), ...reference, label:'Grace'}); await db.highlights.add({...newMutableFields(), ...reference, style:null}); await db.verseNotes.add({...newMutableFields(), ...reference, bodyMd:'Grace remembered'});
  const before = await snapshot(db), saved = await readSavedScripture(db); expect(saved.bookmarks).toHaveLength(1); expect(saved.highlights).toHaveLength(1); expect(saved.notes).toHaveLength(1);
  const hits = await searchPersonalPages(db, 'JHN.3.16'); expect(hits.saved.total).toBe(3); expect(await snapshot(db)).toEqual(before);
 });
 it('does not silently select another collection when the target is missing', async () => {
  const db = await database(); await new CollectionRepository(db).create('First'); expect((await readCollection(db, 'missing')).selected).toBeNull();
 });
 it('retains full ranges, translation identity, and return URLs', () => {
  const origin = '/history?period=2025&shown=35&view=prayer'; const url = new URL(savedPassageUrl(reference, origin), 'https://local');
  expect(url.searchParams.get('endVerse')).toBe('18'); expect(url.searchParams.get('translation')).toBe('BSB'); expect(url.searchParams.get('end')).toBe('JHN.3.18'); expect(url.searchParams.get('return')).toBe(origin);
  expect(new URL(withSearchReturn('/prayer/test?entry=update%3Aid', '/search?q=hope&prayersShown=30'), 'https://local').searchParams.get('entry')).toBe('update:id');
 });
 it('normalizes unsafe and invalid optional URL state', () => {
  expect(parseSearchQuery('?scope=invalid&notes=yes&book=invalid&testament=x&prayersShown=-1&return=//evil')).toMatchObject({scope:'all', notes:false, book:'', testament:null, returnTo:'/today', shown:{prayers:10}});
  expect(parseSearchQuery('?scope=prayers&prayersShown=41').shown.prayers).toBe(60);
  expect(parseSavedQuery('?view=unknown&shown=NaN').view).toBe('bookmarks');
 });
 it('centers long excerpts and highlights original unicode text safely', () => {
  const value = 'Earlier words. '.repeat(50) + 'Mária remembered grace.' + ' Later words.'.repeat(50), excerpt = matchExcerpt(value, 'maria');
  expect(excerpt).toContain('Mária'); expect(excerpt.length).toBeLessThanOrEqual(182); expect(matchingRanges('Mária & <script>', 'maria')).toEqual([[0,5]]);
 });
 it('notes and removals reject stale revisions without altering saved content', async () => {
  const db = await database(), repo = new CollectionRepository(db), parent = await repo.create('Promises'), item = await repo.addReference(parent.id, reference, 'First');
  const saved = await repo.saveItemNote(item.id, 'Second', item.revision); await expect(repo.saveItemNote(item.id, 'Stale', item.revision)).rejects.toThrow(); await expect(repo.removeItem(item.id, item.revision)).rejects.toThrow();
  expect((await db.collectionItems.get(item.id))?.note).toBe('Second'); expect((await repo.saveItemNote(item.id, 'Second', saved.revision)).revision).toBe(saved.revision);
  await repo.rename(parent.id, 'Renamed', null, parent.revision); await expect(repo.removeCollection(parent.id, parent.revision)).rejects.toThrow();
  await repo.removeCollection(parent.id); await expect(repo.saveItemNote(item.id, 'Cannot resurrect')).rejects.toThrow();
 });
});

