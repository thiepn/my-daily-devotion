import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { recoverySchemaV2, recoverySchemaV3, schemaV1 } from "../data/schema";
import { createBackupSnapshot } from "../data/backup";
import { newJournalState, readJournalEpoch } from "./journal";
import { ReflectionRepository } from "../data/repositories/reflections";
import { PrayerRepository } from "../data/repositories/prayers";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import { CollectionRepository } from "../data/repositories/collections";
import { PersonRepository } from "../data/repositories/prayer-metadata";
import { captureSavedVersion, isSavedWriting, SavedVersionRepository } from "./saved-versions";
import { restoreSavedVersion } from "./restore-version";
const databases: Dexie[] = [];
async function setup() { const db = new MddDatabase(`saved-version-${crypto.randomUUID()}`); databases.push(db); await prepareDatabase(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(async table => [table.name, await table.toArray()])); }

it("adds only four internal stores to v2, retaining original indexes, epoch, writing and timestamps", async () => {
  const name = `upgrade-version-${crypto.randomUUID()}`, legacy = new Dexie(name); databases.push(legacy);
  legacy.version(1).stores(schemaV1); legacy.version(2).stores(recoverySchemaV2); await legacy.open();
  const journal = newJournalState(); await legacy.table("draftJournalState").add(journal);
  const metadata = { key: "database", schemaVersion: 2, contractVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
  await legacy.table("schemaMetadata").add(metadata);
  await legacy.table("editorDraftContents").add({ id: "retained", generation: 2, payload: { body: "Private writing" } });
  const indexes = Object.fromEntries(legacy.tables.map(table => [table.name, table.schema.indexes.map(index => index.src)])); legacy.close();
  const upgraded = new MddDatabase(name); databases.push(upgraded); await prepareDatabase(upgraded);
  for (const [table, expected] of Object.entries(indexes)) expect(upgraded.table(table).schema.indexes.map(index => index.src)).toEqual(expected);
  expect(upgraded.tables.map(table => table.name).filter(table => !Object.hasOwn(indexes, table)).sort()).toEqual(Object.keys(recoverySchemaV3).sort());
  expect(await readJournalEpoch(upgraded)).toBe(journal.epoch);
  expect(await upgraded.editorDraftContents.get("retained")).toMatchObject({ generation: 2, payload: { body: "Private writing" } });
  expect(await upgraded.schemaMetadata.get("database")).toMatchObject({ schemaVersion: 3, contractVersion: 1, createdAt: metadata.createdAt });
  expect(await upgraded.savedVersions.count()).toBe(0); expect(await upgraded.removalGroups.count()).toBe(0);
});

it("an aborted v3 upgrade leaves v2 records, indexes and journal intact", async () => {
  const name = `abort-version-${crypto.randomUUID()}`, legacy = new Dexie(name); databases.push(legacy);
  legacy.version(1).stores(schemaV1); legacy.version(2).stores(recoverySchemaV2); await legacy.open();
  const journal = newJournalState(); await legacy.table("draftJournalState").add(journal); legacy.close();
  const upgraded = new MddDatabase(name); databases.push(upgraded); upgraded.version(3).upgrade(() => { throw new Error("Abort v3 deliberately"); });
  await expect(upgraded.open()).rejects.toThrow("Abort v3 deliberately"); await legacy.open();
  expect(legacy.verno).toBe(2); expect(await legacy.table("draftJournalState").get("journal")).toEqual(journal);
  expect(legacy.tables.map(table => table.name)).not.toContain("savedVersions");
});

it("captures prior reflection writing, prunes to twenty and keeps ordinary backups and browsing write-free", async () => {
  const db = await setup(), reflections = new ReflectionRepository(db), versions = new SavedVersionRepository(db);
  const first = await reflections.saveDaily("2026-10-08", "Original"); expect(await db.savedVersions.count()).toBe(0);
  let current = first.reflection;
  for (let i = 1; i <= 25; i++) current = (await reflections.saveDaily("2026-10-08", `Version ${i}`, current.revision)).reflection;
  const directory = await versions.list({ targetKey: `reflection:${current.id}` }); expect(directory.total).toBe(20);
  expect(await db.savedVersionContents.count()).toBe(20); expect(await db.activityEvents.count()).toBe(1);
  const before = await snapshot(db); await versions.list({ limit: 5 }); const read = await versions.read(directory.rows[0]!.id);
  expect(read.kind).toBe("available"); if (read.kind === "available") expect(read.previousJournal).toBe(false);
  expect(await snapshot(db)).toEqual(before);
  const backup = await createBackupSnapshot(db); expect(Object.keys(backup.data)).toHaveLength(21);
  expect(JSON.stringify(backup)).not.toContain("savedVersionContents"); expect(JSON.stringify(backup)).not.toContain('"bodyMd":"Original"');
  const count = await db.savedVersions.count(); await reflections.saveDaily("2026-10-08", "Version 25", current.revision); expect(await db.savedVersions.count()).toBe(count);
});

it("protects the six supported writing kinds, excluding creation, settings, prayed actions and unchanged text", async () => {
  const db = await setup(), prayers = new PrayerRepository(db), notes = new VerseNoteRepository(db), collections = new CollectionRepository(db), people = new PersonRepository(db);
  const prayer = await prayers.createPrayer({ body: "Request" }); await prayers.updateBody(prayer.id, "Request", prayer.revision); expect(await db.savedVersions.count()).toBe(0);
  const latest = (await prayers.get(prayer.id))!; await prayers.updateBody(prayer.id, "Revised request", latest.revision); await prayers.markPrayed(prayer.id);
  const reference = { translationId: "BSB", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.18" } as const;
  const note = await notes.save(reference, "Note"); await notes.save(reference, "Revised note", note.revision);
  const collection = await collections.create("Collection", "Description"); await collections.rename(collection.id, "Renamed", "Changed", collection.revision);
  const item = await collections.addReference(collection.id, reference, "Item note"); await collections.saveItemNote(item.id, "Revised item", item.revision);
  const person = await people.createPerson("Person", "Friend", "Private notes"); await people.updatePerson(person.id, { name: "Person", relationship: "Family", notes: "Revised notes" }, person.revision);
  await new ReflectionRepository(db).saveDaily("2026-10-08", "Reflection"); const saved = (await new ReflectionRepository(db).getDaily("2026-10-08"))!; await new ReflectionRepository(db).saveDaily("2026-10-08", "Revised reflection", saved.revision);
  expect((await db.savedVersions.toArray()).map(row => row.kind).sort()).toEqual(["collection", "collection-item", "person", "prayer-wording", "reflection", "verse-note"]);
  expect(JSON.stringify(await db.savedVersions.toArray())).not.toMatch(/Private notes|Person|Revised request/);
});

it("rolls version capture and domain mutation back together on failure and rejects stale saves", async () => {
  const db = await setup(), repo = new ReflectionRepository(db), first = await repo.saveDaily("2026-10-08", "Original"), before = await snapshot(db);
  const fail = () => { throw new Error("Version quota failure"); }; db.savedVersionContents.hook("creating", fail);
  await expect(repo.saveDaily("2026-10-08", "Changed", first.reflection.revision)).rejects.toThrow("Version quota failure");
  db.savedVersionContents.hook("creating").unsubscribe(fail); expect(await snapshot(db)).toEqual(before);
  const changed = await repo.saveDaily("2026-10-08", "Other tab", first.reflection.revision), after = await snapshot(db);
  await expect(repo.saveDaily("2026-10-08", "Stale", first.reflection.revision)).rejects.toThrow("changed in another tab"); expect(await snapshot(db)).toEqual(after);
  await expect(captureSavedVersion(db, "reflection", first.reflection, changed.reflection)).rejects.toThrow("domain save transaction");
});

it("rejects unsupported fields and keeps versions from a replacement journal separate", async () => {
  expect(isSavedWriting({ kind: "person", name: "Person", relationship: null, notes: null, password: "Never allowed" })).toBe(false);
  expect(isSavedWriting({ kind: "verse-note", bodyMd: "Note", reference: { translationId: "BSB", startVerseKey: "JHN.3.999", endVerseKey: "JHN.3.999" } })).toBe(false);
  const db = await setup(), repo = new ReflectionRepository(db), first = await repo.saveDaily("2026-10-08", "Original"); await repo.saveDaily("2026-10-08", "Changed", first.reflection.revision);
  const version = (await db.savedVersions.toArray())[0]!; await db.draftJournalState.put(newJournalState());
  const read = await new SavedVersionRepository(db).read(version.id); expect(read.kind).toBe("available"); if (read.kind === "available") expect(read.previousJournal).toBe(true);
});

it("restores writing with one new revision, no new event, captures the replaced version and rejects replay", async () => {
  const db = await setup(), repo = new ReflectionRepository(db), first = await repo.saveDaily("2024-02-29", "Original");
  const changed = await repo.saveDaily("2024-02-29", "Changed", first.reflection.revision), version = (await db.savedVersions.toArray())[0]!;
  const events = await db.activityEvents.toArray(), result = await restoreSavedVersion(db, version.id, changed.reflection.revision);
  expect(result.kind).toBe("committed"); if (result.kind === "committed") expect(result.record).toMatchObject({ id: first.reflection.id, localDate: "2024-02-29", createdAt: first.reflection.createdAt, revision: 3, bodyMd: "Original" });
  expect(await db.activityEvents.toArray()).toEqual(events); expect(await db.savedVersions.count()).toBe(2);
  const before = await snapshot(db); expect((await restoreSavedVersion(db, version.id, 2)).kind).toBe("conflict"); expect(await snapshot(db)).toEqual(before);
  expect((await restoreSavedVersion(db, version.id, 3)).kind).toBe("unchanged"); expect(await snapshot(db)).toEqual(before);
  await repo.removeDaily("2024-02-29", 3); const removed = await snapshot(db); expect((await restoreSavedVersion(db, version.id, 4)).kind).toBe("unavailable"); expect(await snapshot(db)).toEqual(removed);
});

it("does not restore answered prayer wording or previous-journal versions", async () => {
  const db = await setup(), prayers = new PrayerRepository(db), first = await prayers.createPrayer({ body: "Original" });
  const changed = await prayers.updateBody(first.id, "Changed", first.revision), version = (await db.savedVersions.toArray())[0]!;
  const answered = await prayers.answer(first.id, null, undefined, changed.revision), before = await snapshot(db);
  expect((await restoreSavedVersion(db, version.id, answered.prayer.revision)).kind).toBe("unavailable"); expect(await snapshot(db)).toEqual(before);
  await db.draftJournalState.put(newJournalState()); const replaced = await snapshot(db);
  expect((await restoreSavedVersion(db, version.id, answered.prayer.revision)).kind).toBe("unavailable"); expect(await snapshot(db)).toEqual(replaced);
});
