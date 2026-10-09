import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createBackupSnapshot, stableDataJson } from "./backup";
import { MddDatabase, prepareDatabase } from "./database";
import { recoverySchemaV2, schemaV1 } from "./schema";
import { generateMddBackup, commitMddRestore, prepareMddRestore } from "./portability";
import { PrayerRepository } from "./repositories/prayers";
import { ReflectionRepository } from "./repositories/reflections";
import { newJournalState, readJournalEpoch } from "../recovery/journal";

const handles: Dexie[] = [];
const newName = () => "mdd-p1-compat-" + crypto.randomUUID();
const track = <T extends Dexie>(database: T): T => { handles.push(database); return database; };
const timestamp = "2026-09-16T12:00:00.000Z";

afterEach(async () => {
  const names = [...new Set(handles.map(database => database.name))];
  for (const database of handles.splice(0)) database.close();
  for (const name of names) await Dexie.delete(name);
});

async function savedJournal() {
  const source = track(new MddDatabase(newName()));
  await prepareDatabase(source);
  const reflection = await new ReflectionRepository(source).saveDaily("2026-09-16", "Journal writing survives the upgrade.");
  const repository = new PrayerRepository(source);
  const retained = await repository.createPrayer({ body: "Pray for the family." });
  const removed = await repository.createPrayer({ body: "Previously removed request." });
  await repository.softDelete(removed.id);
  await source.preferences.put({ key: "theme-mode", value: "dark", updatedAt: timestamp });
  return { source, data: (await createBackupSnapshot(source)).data, reflectionId: reflection.reflection.id, retainedId: retained.id, removedId: removed.id };
}

async function seedLegacy(name: string, version: 1 | 2, data: Record<string, unknown[]>, contract = 1) {
  const legacy = track(new Dexie(name));
  legacy.version(1).stores(schemaV1);
  if (version === 2) legacy.version(2).stores(recoverySchemaV2);
  await legacy.open();
  const journal = newJournalState();
  const metadata = { key: "database", schemaVersion: version, contractVersion: contract, createdAt: timestamp, updatedAt: timestamp };
  await legacy.transaction("rw", legacy.tables, async () => {
    for (const [table, rows] of Object.entries(data)) if (rows.length) await legacy.table(table).bulkPut(rows);
    await legacy.table("schemaMetadata").put(metadata);
    if (version === 2) {
      await legacy.table("draftJournalState").put(journal);
      await legacy.table("editorDrafts").put({
        id: "unfinished-note", formatVersion: 1, kind: "reflection", targetKey: "reflection:2026-09-16",
        journalEpoch: journal.epoch, createdAt: timestamp, updatedAt: timestamp, generation: 1,
        state: "active", context: { returnTo: "/today", reading: null }, lineage: null, commitment: null,
      });
      await legacy.table("editorDraftContents").put({
        id: "unfinished-note", generation: 1,
        payload: { kind: "reflection", localDate: "2026-09-16", bodyMd: "PRIVATE UNFINISHED WRITING",
          baseline: null, pendingReferences: [], dismissedReferences: false },
      });
    }
  });
  legacy.close();
  return { legacy, journal, metadata };
}

async function legacyContents(legacy: Dexie, tables: string[]) {
  return Object.fromEntries(await Promise.all(tables.map(async table => [table, await legacy.table(table).toArray()])));
}

describe("P1 — published journal upgrade and recovery compatibility", () => {
  it("preserves v1 saved writing, dates, history, tombstones and preferences through v3 and another restart", async () => {
    const original = await savedJournal();
    const name = newName();
    await seedLegacy(name, 1, original.data);
    const upgraded = track(new MddDatabase(name));
    await prepareDatabase(upgraded);
    expect(stableDataJson((await createBackupSnapshot(upgraded)).data)).toBe(stableDataJson(original.data));
    expect(await upgraded.reflections.get(original.reflectionId)).toMatchObject({ bodyMd: "Journal writing survives the upgrade." });
    expect(await upgraded.prayers.get(original.retainedId)).toMatchObject({ body: "Pray for the family.", deletedAt: null });
    expect((await upgraded.prayers.get(original.removedId))?.deletedAt).not.toBeNull();
    expect(await upgraded.preferences.get("theme-mode")).toMatchObject({ value: "dark" });
    expect(await upgraded.schemaMetadata.get("database")).toMatchObject({ schemaVersion: 3, contractVersion: 1, createdAt: timestamp });
    expect(await upgraded.savedVersions.count()).toBe(0);
    expect(await upgraded.removalGroups.count()).toBe(0);
    const epoch = await readJournalEpoch(upgraded);
    const metadata = await upgraded.schemaMetadata.toArray();
    upgraded.close();
    const reopened = track(new MddDatabase(name));
    await prepareDatabase(reopened);
    expect(await readJournalEpoch(reopened)).toBe(epoch);
    expect(await reopened.schemaMetadata.toArray()).toEqual(metadata);
    expect(stableDataJson((await createBackupSnapshot(reopened)).data)).toBe(stableDataJson(original.data));
  });

  it("preserves v2 private draft and journal identity while adding empty v3 stores and retaining portable-v1 boundaries", async () => {
    const original = await savedJournal();
    const name = newName();
    const { journal } = await seedLegacy(name, 2, original.data);
    const upgraded = track(new MddDatabase(name));
    await prepareDatabase(upgraded);
    expect(stableDataJson((await createBackupSnapshot(upgraded)).data)).toBe(stableDataJson(original.data));
    expect(await readJournalEpoch(upgraded)).toBe(journal.epoch);
    expect(await upgraded.editorDraftContents.get("unfinished-note")).toMatchObject({ payload: { bodyMd: "PRIVATE UNFINISHED WRITING" } });
    expect(await upgraded.editorDrafts.get("unfinished-note")).toMatchObject({ journalEpoch: journal.epoch, state: "active" });
    expect(await upgraded.schemaMetadata.get("database")).toMatchObject({ schemaVersion: 3, contractVersion: 1 });
    expect(await upgraded.savedVersions.count()).toBe(0);
    expect(await upgraded.removalGroups.count()).toBe(0);
    const ordinary = await createBackupSnapshot(upgraded);
    expect(ordinary.manifest).toMatchObject({ schemaVersion: 1, contractVersion: 1, formatVersion: 1 });
    expect(JSON.stringify(ordinary)).not.toContain("PRIVATE UNFINISHED WRITING");
  });

  it("rolls back an interrupted v2-to-v3 upgrade entirely and succeeds on a clean retry", async () => {
    const original = await savedJournal();
    const name = newName();
    const { legacy, journal, metadata } = await seedLegacy(name, 2, original.data);
    const failing = track(new MddDatabase(name));
    failing.version(3).upgrade(async transaction => {
      await transaction.table("preferences").put({ key: "migration-probe", value: "MUST ROLL BACK", updatedAt: timestamp });
      throw new Error("Injected upgrade interruption");
    });
    await expect(failing.open()).rejects.toThrow("Injected upgrade interruption");
    await legacy.open();
    expect(legacy.verno).toBe(2);
    expect(await legacy.table("schemaMetadata").get("database")).toEqual(metadata);
    expect(await legacy.table("draftJournalState").get("journal")).toEqual(journal);
    expect(await legacy.table("editorDraftContents").get("unfinished-note")).toMatchObject({ payload: { bodyMd: "PRIVATE UNFINISHED WRITING" } });
    expect(await legacy.table("preferences").get("migration-probe")).toBeUndefined();
    expect(legacy.tables.map(t => t.name)).not.toContain("savedVersions");
    expect(stableDataJson(await legacyContents(legacy, Object.keys(original.data)))).toBe(stableDataJson(original.data));
    legacy.close();
    const recovered = track(new MddDatabase(name));
    await prepareDatabase(recovered);
    expect(await readJournalEpoch(recovered)).toBe(journal.epoch);
    expect(stableDataJson((await createBackupSnapshot(recovered)).data)).toBe(stableDataJson(original.data));
  });

  it.each([1, 2] as const)("rejects a v%s journal with an incompatible stored domain contract without mutation", async version => {
    const original = await savedJournal();
    const name = newName();
    const { legacy, metadata, journal } = await seedLegacy(name, version, original.data, 999);
    const upgraded = track(new MddDatabase(name));
    await expect(prepareDatabase(upgraded)).rejects.toThrow(/compatible app update/i);
    await legacy.open();
    expect(legacy.verno).toBe(version);
    expect(await legacy.table("schemaMetadata").get("database")).toEqual(metadata);
    expect(stableDataJson(await legacyContents(legacy, Object.keys(original.data)))).toBe(stableDataJson(original.data));
    if (version === 2) {
      expect(await legacy.table("draftJournalState").get("journal")).toEqual(journal);
      expect(await legacy.table("editorDraftContents").get("unfinished-note")).toMatchObject({ payload: { bodyMd: "PRIVATE UNFINISHED WRITING" } });
    }
  });

  it("reviews and replaces portable-v1 data on upgraded schema 3 without deleting private writing or changing database metadata", async () => {
    const original = await savedJournal();
    const name = newName();
    await seedLegacy(name, 2, original.data);
    const target = track(new MddDatabase(name));
    await prepareDatabase(target);
    const previousEpoch = await readJournalEpoch(target);
    const previousDraft = await target.editorDraftContents.get("unfinished-note");
    const metadata = await target.schemaMetadata.toArray();

    const source = track(new MddDatabase(newName()));
    await prepareDatabase(source);
    const incoming = await new PrayerRepository(source).createPrayer({ body: "Restored from portable v1" });
    const archive = (await generateMddBackup(source, "1.2.5")).bytes;
    const review = await prepareMddRestore(archive, "", "replace", target);
    expect(review.manifest).toMatchObject({ formatVersion: 1, schemaVersion: 1 });
    expect((await commitMddRestore(review, target)).kind).toBe("committed");
    expect(await target.prayers.get(incoming.id)).toMatchObject({ body: "Restored from portable v1" });
    expect(await target.prayers.get(original.retainedId)).toBeUndefined();
    expect(await target.editorDraftContents.get("unfinished-note")).toEqual(previousDraft);
    expect(await target.schemaMetadata.toArray()).toEqual(metadata);
    expect(await readJournalEpoch(target)).not.toBe(previousEpoch);
  });
});
