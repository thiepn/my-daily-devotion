import type { MddDatabase } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import { PrayerRepository } from "../data/repositories/prayers";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import { CollectionRepository } from "../data/repositories/collections";
import { PersonRepository } from "../data/repositories/prayer-metadata";
import type { LocalDate } from "../domain/types";
import { editableWriting, SavedVersionRepository, savedVersionTables, writingTables } from "./saved-versions";
import type { SavedWriting, WritingRecords } from "./saved-types";

export type RestoreVersionResult =
  | { kind: "committed" | "unchanged"; record: WritingRecords[keyof WritingRecords] }
  | { kind: "conflict"; currentRevision: number; currentWriting: SavedWriting }
  | { kind: "unavailable"; reason: string }
  | { kind: "failed"; reason: string };

/** Explicit, revision-checked command. The UI must review and confirm first. */
export async function restoreSavedVersion(database: MddDatabase, versionId: string, expectedRevision: number): Promise<RestoreVersionResult> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) return { kind: "unavailable", reason: "Review the current saved writing first." };
  try {
    return await database.transaction("rw", [database.reflections, database.prayers, database.verseNotes, database.collections, database.collectionItems, database.people, database.devotionDays, database.scriptureLinks, database.activityEvents, ...savedVersionTables(database)], async (): Promise<RestoreVersionResult> => {
      const selected = await new SavedVersionRepository(database).read(versionId);
      if (selected.kind !== "available") return { kind: "unavailable", reason: "This saved version is unavailable." };
      if (selected.previousJournal) return { kind: "unavailable", reason: "This version belongs to a previous journal. It remains available for copying." };
      const { metadata, contents } = selected;
      const current = await database.table(writingTables[metadata.kind]).get(metadata.targetId) as WritingRecords[keyof WritingRecords] | undefined;
      if (!current || current.deletedAt !== null) return { kind: "unavailable", reason: "The original record was removed. This action cannot recreate it." };
      const currentWriting = editableWriting(metadata.kind, current), writing = contents.writing;
      if (current.revision !== expectedRevision) return { kind: "conflict", currentRevision: current.revision, currentWriting };
      if (writing.kind === "reflection" && currentWriting.kind === "reflection" && writing.localDate !== currentWriting.localDate || writing.kind === "verse-note" && currentWriting.kind === "verse-note" && JSON.stringify(writing.reference) !== JSON.stringify(currentWriting.reference) || writing.kind === "collection-item" && currentWriting.kind === "collection-item" && (writing.collectionId !== currentWriting.collectionId || JSON.stringify(writing.reference) !== JSON.stringify(currentWriting.reference))) return { kind: "unavailable", reason: "The original date or Scripture relationship no longer matches." };
      if (writing.kind === "prayer-wording" && !["ACTIVE", "WAITING"].includes((current as WritingRecords["prayer-wording"]).status)) return { kind: "unavailable", reason: "Answered and archived prayer wording is read-only. Copy this version if needed." };
      if (JSON.stringify(currentWriting) === JSON.stringify(writing)) return { kind: "unchanged", record: current };
      let record: WritingRecords[keyof WritingRecords];
      switch (writing.kind) {
        case "reflection": {
          const repo = new ReflectionRepository(database), daily = await repo.getDaily(writing.localDate as LocalDate);
          if (daily?.id !== current.id) return { kind: "unavailable", reason: "Another reflection occupies this devotional date." };
          record = (await repo.saveDaily(writing.localDate as LocalDate, writing.bodyMd, expectedRevision)).reflection;
          break;
        }
        case "prayer-wording": record = await new PrayerRepository(database).updateBody(current.id, writing.body, expectedRevision); break;
        case "verse-note": {
          const repo = new VerseNoteRepository(database), exact = await repo.getExact(writing.reference);
          if (exact?.id !== current.id) return { kind: "unavailable", reason: "Another note occupies this Scripture range." };
          record = await repo.save(writing.reference, writing.bodyMd, expectedRevision); break;
        }
        case "collection": record = await new CollectionRepository(database).rename(current.id, writing.name, writing.description, expectedRevision); break;
        case "collection-item": record = await new CollectionRepository(database).saveItemNote(current.id, writing.note ?? "", expectedRevision); break;
        case "person": record = await new PersonRepository(database).updatePerson(current.id, { name: writing.name, relationship: writing.relationship, notes: writing.notes }, expectedRevision); break;
      }
      return { kind: "committed", record };
    });
  } catch {
    return { kind: "failed", reason: "This version could not be restored. Your current writing and the saved version remain available." };
  }
}
