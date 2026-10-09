import type { ScriptureReference } from "../domain/types";
import type { MddDatabase } from "../data/database";
import { savedPassageUrl } from "./context";
import { matchExcerpt, normalizeSearch } from "./text";

export interface PersonalSearchHit {
  id: string; title: string; excerpt: string; href: string; kind: string; updatedAt: string; reference?: ScriptureReference;
}
export interface PersonalSearchResults {
  prayers: PersonalSearchHit[]; reflections: PersonalSearchHit[]; people: PersonalSearchHit[]; saved: PersonalSearchHit[];
}
export interface SearchPage<T> { items: T[]; total: number; }
export type PersonalSearchPages = { [K in keyof PersonalSearchResults]: SearchPage<PersonalSearchHit> };
export interface PersonalSearchOptions { includePersonNotes?: boolean; matchingVerseKeys?: string[]; shown?: Partial<Record<keyof PersonalSearchResults, number>>; }
const groups = ["prayers", "reflections", "people", "saved"] as const;
export function newestHit(a: PersonalSearchHit, b: PersonalSearchHit) { return b.updatedAt.localeCompare(a.updatedAt) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id); }

/** One readonly snapshot; parent tombstones are checked before exposing child writing. */
export async function searchPersonalPages(database: MddDatabase, rawQuery: string, options: PersonalSearchOptions = {}): Promise<PersonalSearchPages> {
  const query = normalizeSearch(rawQuery.trim());
  const empty: PersonalSearchResults = { prayers: [], reflections: [], people: [], saved: [] };
  if (!query) return { prayers: {items: [], total: 0}, reflections: {items: [], total: 0}, people: {items: [], total: 0}, saved: {items: [], total: 0} };
  const matches = (value: string | null | undefined) => Boolean(value && normalizeSearch(value).includes(query));
  const excerpt = (value: string) => matchExcerpt(value, rawQuery);
  const matchedVerses = new Map<string, number[]>();
  for (const key of options.matchingVerseKeys ?? []) {
    const [book, chapter, verse] = key.split('.');
    const values = matchedVerses.get(book!) ?? []; values.push(Number(chapter) * 1000 + Number(verse)); matchedVerses.set(book!, values);
  }
  const referenceMatches = (ref: ScriptureReference) => {
    if (ref.translationId !== 'BSB') return false;
    const [book, chapter, verse] = ref.startVerseKey.split('.'), [endBook, endChapter, endVerse] = ref.endVerseKey.split('.');
    return book === endBook && (matchedVerses.get(book!) ?? []).some(value => value >= Number(chapter) * 1000 + Number(verse) && value <= Number(endChapter) * 1000 + Number(endVerse));
  };
  // Bulk reads avoid a native cursor round trip for every row, especially expensive in WebKit.
  const [prayers, updates, resolutions, reflections, people, notes, collections, collectionItems, categories, bookmarks, highlights] = await database.transaction("r", [database.prayers, database.prayerUpdates, database.prayerResolutions, database.reflections, database.people, database.verseNotes, database.collections, database.collectionItems, database.categories, database.bookmarks, database.highlights], () => Promise.all([
    database.prayers.toArray().then(items => items.filter(item => !item.deletedAt)), database.prayerUpdates.toArray().then(items => items.filter(item => !item.deletedAt)),
    database.prayerResolutions.toArray().then(items => items.filter(item => !item.deletedAt)), database.reflections.toArray().then(items => items.filter(item => !item.deletedAt)),
    database.people.toArray().then(items => items.filter(item => !item.deletedAt)), database.verseNotes.toArray().then(items => items.filter(item => !item.deletedAt)),
    database.collections.toArray().then(items => items.filter(item => !item.deletedAt)), database.collectionItems.toArray().then(items => items.filter(item => !item.deletedAt)),
    database.categories.toArray().then(items => items.filter(item => !item.deletedAt)), database.bookmarks.toArray().then(items => items.filter(item => !item.deletedAt)),
    database.highlights.toArray().then(items => items.filter(item => !item.deletedAt)),
  ]));
  const peopleById = new Map(people.map(item => [item.id, item])), categoriesById = new Map(categories.map(item => [item.id, item]));
  const prayersById = new Map(prayers.map(item => [item.id, item])), collectionsById = new Map(collections.map(item => [item.id, item]));
  for (const prayer of prayers) if ([prayer.body, peopleById.get(prayer.personId ?? "")?.name, categoriesById.get(prayer.categoryId ?? "")?.name].some(matches)) empty.prayers.push({ id: prayer.id, title: excerpt(prayer.body), excerpt: excerpt(prayer.body), href: `/prayer/${prayer.id}`, kind: `Prayer · ${prayer.status.toLowerCase()}`, updatedAt: prayer.updatedAt });
  for (const update of updates) {
    const parent = prayersById.get(update.prayerId); if (!parent || !matches(update.body)) continue;
    empty.prayers.push({ id: update.id, title: excerpt(parent.body), excerpt: excerpt(update.body), href: `/prayer/${parent.id}?${new URLSearchParams({ entry: `update:${update.id}` })}`, kind: update.type === "encouragement" ? "Prayer encouragement" : "Prayer update", updatedAt: update.updatedAt });
  }
  for (const answer of resolutions) {
    const parent = prayersById.get(answer.prayerId); if (!parent || !matches(answer.reflectionMd)) continue;
    empty.prayers.push({ id: answer.id, title: excerpt(parent.body), excerpt: excerpt(answer.reflectionMd ?? ""), href: `/prayer/${parent.id}?${new URLSearchParams({ entry: `answer:${answer.id}` })}`, kind: "Answered prayer", updatedAt: answer.updatedAt });
  }
  empty.reflections = reflections.filter(item => matches(item.bodyMd)).map(item => ({ id: item.id, title: `Reflection · ${item.localDate}`, excerpt: excerpt(item.bodyMd), href: `/today/reflection/${item.localDate}`, kind: "Reflection", updatedAt: item.updatedAt }));
  empty.people = people.filter(item => [item.name, item.relationship, options.includePersonNotes ? item.notes : null].some(matches)).map(item => ({ id: item.id, title: item.name, excerpt: excerpt([item.relationship, options.includePersonNotes ? item.notes : null].filter(Boolean).join(" · ") || "Prayer person"), href: `/prayer/people?${new URLSearchParams({ entry: item.id })}`, kind: "Person", updatedAt: item.updatedAt }));
  const refTitle = (item: ScriptureReference) => `${item.startVerseKey}–${item.endVerseKey}`;
  for (const note of notes) if (matches(note.bodyMd) || matches(refTitle(note)) || referenceMatches(note)) empty.saved.push({ id: note.id, title: refTitle(note), excerpt: excerpt(note.bodyMd), href: savedPassageUrl(note), kind: "Verse note", reference: note, updatedAt: note.updatedAt });
  for (const bookmark of bookmarks) if (matches(bookmark.label) || matches(refTitle(bookmark)) || referenceMatches(bookmark)) empty.saved.push({ id: bookmark.id, title: bookmark.label ?? refTitle(bookmark), excerpt: excerpt(bookmark.label ?? "Saved bookmark"), href: savedPassageUrl(bookmark), kind: "Bookmark", reference: bookmark, updatedAt: bookmark.updatedAt });
  for (const highlight of highlights) if (matches(refTitle(highlight)) || referenceMatches(highlight)) empty.saved.push({ id: highlight.id, title: refTitle(highlight), excerpt: "Highlighted passage", href: savedPassageUrl(highlight), kind: "Highlight", reference: highlight, updatedAt: highlight.updatedAt });
  for (const collection of collections) if (matches(collection.name) || matches(collection.description)) empty.saved.push({ id: collection.id, title: collection.name, excerpt: excerpt(collection.description ?? "Scripture collection"), href: `/bible/collections?${new URLSearchParams({ collection: collection.id })}`, kind: "Collection", updatedAt: collection.updatedAt });
  for (const item of collectionItems) {
    const parent = collectionsById.get(item.collectionId); if (!parent || !(matches(item.note) || referenceMatches(item))) continue;
    empty.saved.push({ id: item.id, title: parent.name, excerpt: excerpt(item.note ?? ""), href: `/bible/collections?${new URLSearchParams({ collection: parent.id, item: item.id })}`, kind: "Collection note", reference: item, updatedAt: item.updatedAt });
  }
  return Object.fromEntries(groups.map(key => { const hits = empty[key].sort(newestHit); return [key, { total: hits.length, items: hits.slice(0, options.shown?.[key] ?? 20) }]; })) as PersonalSearchPages;
}
/** Compatible legacy caller, now backed by the same full-result model. */
export async function searchPersonal(database: MddDatabase, rawQuery: string, limitPerGroup = 12): Promise<PersonalSearchResults> {
  const pages = await searchPersonalPages(database, rawQuery, { shown: Object.fromEntries(groups.map(key => [key, limitPerGroup])) });
  return Object.fromEntries(groups.map(key => [key, pages[key].items])) as unknown as PersonalSearchResults;
}

