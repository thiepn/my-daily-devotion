import Dexie from "dexie";
import type { MddDatabase } from "../data/database";
import { assertInstant, assertLocalDate } from "../domain/time";
import { validateBackupRecords } from "../data/validation";
import { readJournalEpoch } from "./journal";
import type { SavedVersionContents, SavedVersionMetadata, SavedWriting, WritingKind, WritingRecords } from "./saved-types";

export const writingTables = { reflection: "reflections", "prayer-wording": "prayers", "verse-note": "verseNotes", collection: "collections", "collection-item": "collectionItems", person: "people" } as const;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value: unknown): value is string => typeof value === "string" && value.length <= 1_000_000;
const nullableText = (value: unknown) => value === null || text(value);
const reference = (value: unknown) => {
  if (!object(value) || !exact(value, ["translationId", "startVerseKey", "endVerseKey"])) return false;
  try {
    validateBackupRecords({ verseNotes: [{ ...value, id: "validation", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", revision: 1, deletedAt: null, bodyMd: "validation" }] });
    return true;
  } catch { return false; }
};
export function isSavedWriting(value: unknown): value is SavedWriting {
  if (!object(value)) return false;
  switch (value.kind) {
    case "reflection": {
      if (!exact(value, ["kind", "bodyMd", "localDate"]) || !text(value.bodyMd) || !value.bodyMd.trim() || typeof value.localDate !== "string") return false;
      try { assertLocalDate(value.localDate); return true; } catch { return false; }
    }
    case "prayer-wording": return exact(value, ["kind", "body"]) && text(value.body) && Boolean(value.body.trim());
    case "verse-note": return exact(value, ["kind", "bodyMd", "reference"]) && text(value.bodyMd) && Boolean(value.bodyMd.trim()) && reference(value.reference);
    case "collection": return exact(value, ["kind", "name", "description"]) && text(value.name) && Boolean(value.name.trim()) && nullableText(value.description);
    case "collection-item": return exact(value, ["kind", "note", "collectionId", "reference"]) && nullableText(value.note) && uuid(value.collectionId) && reference(value.reference);
    case "person": return exact(value, ["kind", "name", "relationship", "notes"]) && text(value.name) && Boolean(value.name.trim()) && nullableText(value.relationship) && nullableText(value.notes);
    default: return false;
  }
}
export function isSavedVersionMetadata(value: unknown): value is SavedVersionMetadata {
  if (!object(value) || !exact(value, ["id", "formatVersion", "journalEpoch", "kind", "targetKey", "targetId", "originalRevision", "capturedAt", "writingDate"]) || !uuid(value.id) || value.formatVersion !== 1 || !uuid(value.journalEpoch) || !uuid(value.targetId) || typeof value.kind !== "string" || !Object.hasOwn(writingTables, value.kind) || value.targetKey !== `${value.kind}:${value.targetId}` || !Number.isSafeInteger(value.originalRevision) || Number(value.originalRevision) < 1 || typeof value.capturedAt !== "string") return false;
  try {
    assertInstant(value.capturedAt);
    if (value.writingDate !== null) { if (typeof value.writingDate !== "string") return false; assertLocalDate(value.writingDate); }
    return value.kind === "reflection" ? value.writingDate !== null : value.writingDate === null;
  } catch { return false; }
}
export function isSavedVersionContents(value: unknown): value is SavedVersionContents {
  return object(value) && exact(value, ["id", "formatVersion", "writing"]) && uuid(value.id) && value.formatVersion === 1 && isSavedWriting(value.writing);
}
export function savedVersionTables(database: MddDatabase) { return [database.savedVersions, database.savedVersionContents, database.draftJournalState]; }
export function editableWriting<K extends WritingKind>(kind: K, record: WritingRecords[K]): SavedWriting {
  // Narrow the union explicitly; include immutable context only where comparisons need it.
  switch (kind) {
    case "reflection": { const item = record as WritingRecords["reflection"]; return { kind, bodyMd: item.bodyMd, localDate: item.localDate }; }
    case "prayer-wording": return { kind, body: (record as WritingRecords["prayer-wording"]).body };
    case "verse-note": { const item = record as WritingRecords["verse-note"]; return { kind, bodyMd: item.bodyMd, reference: { translationId: item.translationId, startVerseKey: item.startVerseKey, endVerseKey: item.endVerseKey } }; }
    case "collection": { const item = record as WritingRecords["collection"]; return { kind, name: item.name, description: item.description }; }
    case "collection-item": { const item = record as WritingRecords["collection-item"]; return { kind, note: item.note, collectionId: item.collectionId, reference: { translationId: item.translationId, startVerseKey: item.startVerseKey, endVerseKey: item.endVerseKey } }; }
    case "person": { const item = record as WritingRecords["person"]; return { kind, name: item.name, relationship: item.relationship, notes: item.notes }; }
  }
  throw new Error("Unsupported saved writing kind.");
}
/** Only explicit repository saves call this inside their encompassing transaction. */
export async function captureSavedVersion<K extends WritingKind>(database: MddDatabase, kind: K, before: WritingRecords[K], after: WritingRecords[K]): Promise<void> {
  if (!Dexie.currentTransaction || Dexie.currentTransaction.db !== database || Dexie.currentTransaction.mode !== "readwrite") throw new Error("Saved versions require the domain save transaction.");
  if (before.deletedAt !== null || before.id !== after.id) return;
  const writing = editableWriting(kind, before), next = editableWriting(kind, after);
  if (JSON.stringify(writing) === JSON.stringify(next)) return;
  if (!isSavedWriting(writing) || !isSavedWriting(next)) throw new Error("Saved writing could not be protected. Nothing has been saved.");
  const id = crypto.randomUUID(), metadata: SavedVersionMetadata = {
    id, formatVersion: 1, journalEpoch: await readJournalEpoch(database), kind,
    targetKey: `${kind}:${before.id}`, targetId: before.id, originalRevision: before.revision,
    capturedAt: new Date().toISOString(), writingDate: writing.kind === "reflection" ? writing.localDate : null,
  };
  if (!isSavedVersionMetadata(metadata)) throw new Error("Invalid saved-version identity.");
  await database.savedVersionContents.add({ id, formatVersion: 1, writing });
  await database.savedVersions.add(metadata);
  // Retention is per target AND journal; replacement journals must not erase older writing.
  const rows = await database.savedVersions.where("targetKey").equals(metadata.targetKey).filter(item => item.journalEpoch === metadata.journalEpoch).toArray();
  rows.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id));
  const stale = rows.slice(20).map(item => item.id);
  await database.savedVersions.bulkDelete(stale);
  await database.savedVersionContents.bulkDelete(stale);
}
export class SavedVersionRepository {
  constructor(private readonly database: MddDatabase) {}
  async list(query: { targetKey?: string; offset?: number; limit?: number } = {}) {
    const offset = query.offset ?? 0, limit = query.limit ?? 20;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid saved-version page.");
    return this.database.transaction("r", this.database.savedVersions, async () => {
      const rows = await (query.targetKey ? this.database.savedVersions.where("targetKey").equals(query.targetKey) : this.database.savedVersions.toCollection()).toArray();
      rows.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)) || String(a.id).localeCompare(String(b.id)));
      return { total: rows.length, rows: rows.slice(offset, offset + limit).map(row => ({ id: row.id, metadata: isSavedVersionMetadata(row) ? row : null })) };
    });
  }
  async read(id: string) {
    return this.database.transaction("r", this.database.savedVersions, this.database.savedVersionContents, this.database.draftJournalState, async () => {
      const metadata = await this.database.savedVersions.get(id);
      if (!metadata) return { kind: "missing" as const };
      const contents = await this.database.savedVersionContents.get(id);
      if (!isSavedVersionMetadata(metadata) || !isSavedVersionContents(contents) || metadata.id !== contents.id || metadata.kind !== contents.writing.kind || (contents.writing.kind === "reflection" && metadata.writingDate !== contents.writing.localDate)) return { kind: "invalid" as const };
      return { kind: "available" as const, metadata, contents, previousJournal: metadata.journalEpoch !== await readJournalEpoch(this.database) };
    });
  }
}
