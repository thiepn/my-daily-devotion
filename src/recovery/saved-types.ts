import type { Bookmark, Category, Collection, CollectionItem, Highlight, Person, Prayer, PrayerResolution, PrayerSchedule, PrayerUpdate, Reflection, ScriptureLink, ScriptureReference, VerseNote } from "../domain/types";

export interface WritingRecords {
  reflection: Reflection;
  "prayer-wording": Prayer;
  "verse-note": VerseNote;
  collection: Collection;
  "collection-item": CollectionItem;
  person: Person;
}
export type WritingKind = keyof WritingRecords;
export type SavedWriting =
  | { kind: "reflection"; bodyMd: string; localDate: string }
  | { kind: "prayer-wording"; body: string }
  | { kind: "verse-note"; bodyMd: string; reference: ScriptureReference }
  | { kind: "collection"; name: string; description: string | null }
  | { kind: "collection-item"; note: string | null; collectionId: string; reference: ScriptureReference }
  | { kind: "person"; name: string; relationship: string | null; notes: string | null };
export interface SavedVersionMetadata {
  id: string; formatVersion: 1; journalEpoch: string; kind: WritingKind;
  targetKey: string; targetId: string; originalRevision: number;
  capturedAt: string; writingDate: string | null;
}
export interface SavedVersionContents { id: string; formatVersion: 1; writing: SavedWriting }
export interface RemovalGroupMetadata {
  id: string; formatVersion: 1; journalEpoch: string;
  removedAt: string; expiresAt: string; state: "available" | "restored" | "expired";
  rootTable: RemovalRootTable; rootId: string;
  affected: { table: RemovalTable; id: string; beforeRevision: number; afterRevision: number }[];
}
export type RemovalTable = "reflections" | "prayers" | "verseNotes" | "highlights" | "bookmarks" | "collections" | "collectionItems" | "people" | "categories" | "scriptureLinks" | "prayerUpdates" | "prayerResolutions" | "prayerSchedules";
export type RemovalRootTable = Exclude<RemovalTable, "scriptureLinks" | "prayerUpdates" | "prayerResolutions" | "prayerSchedules">;
interface RemovalRecords {
  reflections: Reflection; prayers: Prayer; verseNotes: VerseNote; highlights: Highlight;
  bookmarks: Bookmark; collections: Collection; collectionItems: CollectionItem;
  people: Person; categories: Category; scriptureLinks: ScriptureLink;
  prayerUpdates: PrayerUpdate; prayerResolutions: PrayerResolution; prayerSchedules: PrayerSchedule;
}
type RemovedRecord = { [K in RemovalTable]: { table: K; record: RemovalRecords[K] } }[RemovalTable];
// These records will be validated against domain rules before the removal command ships.
// No command or import accepts unvalidated arbitrary records in this foundation.
export interface RemovalGroupContents { id: string; formatVersion: 1; records: RemovedRecord[] }
