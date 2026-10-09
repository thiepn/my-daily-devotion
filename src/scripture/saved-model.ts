import type { MddDatabase } from "../data/database";
import type { Bookmark, Highlight, VerseNote, Collection, CollectionItem } from "../domain/types";
import { shownCount } from "../search/context";
import { safeDataReturn } from "../data/data-context";

export const SAVED_VIEWS = ["bookmarks", "highlights", "notes", "collections"] as const;
export type SavedView = typeof SAVED_VIEWS[number];
export interface SavedScriptureModel { bookmarks: Bookmark[]; highlights: Highlight[]; notes: VerseNote[]; collections: Collection[]; }
export function readSavedScripture(database: MddDatabase): Promise<SavedScriptureModel> {
  return database.transaction("r", database.bookmarks, database.highlights, database.verseNotes, database.collections, async () => {
    const newest = <T extends { updatedAt: string; id: string }>(a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
    const [bookmarks, highlights, notes, collections] = await Promise.all([
      database.bookmarks.filter(item => !item.deletedAt).toArray(), database.highlights.filter(item => !item.deletedAt).toArray(),
      database.verseNotes.filter(item => !item.deletedAt).toArray(), database.collections.filter(item => !item.deletedAt).toArray(),
    ]);
    return { bookmarks: bookmarks.sort(newest), highlights: highlights.sort(newest), notes: notes.sort(newest), collections: collections.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) };
  });
}
export function parseSavedQuery(search: string) {
  const params = new URLSearchParams(search);
  const view = SAVED_VIEWS.find(value => value === params.get("view")) ?? "bookmarks";
  const shown = shownCount(params.get("shown"), 20);
  const returnTo = safeDataReturn(params.get("return") ?? "/bible");
  const normalized = new URLSearchParams({ view });
  if (shown !== 20) normalized.set("shown", String(shown));
  if (params.has("return") && returnTo === params.get("return")) normalized.set("return", returnTo);
  return { view, shown, returnTo, search: `?${normalized}` };
}
export function readCollection(database: MddDatabase, id: string | null) {
  return database.transaction("r", database.collections, database.collectionItems, async () => {
    const collections = (await database.collections.filter(item => !item.deletedAt).toArray()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const selected = id ? collections.find(item => item.id === id) ?? null : collections[0] ?? null;
    const items: CollectionItem[] = selected ? await database.collectionItems.where("collectionId").equals(selected.id).filter(item => !item.deletedAt).toArray() : [];
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return { collections, selected, items };
  });
}
