import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { schemaV1 } from "../data/schema";
import { createBackupSnapshot } from "../data/backup";
import { PrayerRepository } from "../data/repositories/prayers";
import { ReflectionRepository } from "../data/repositories/reflections";
import { DraftRepository } from "./repository";
import { DraftWriter } from "./writer";
import { readJournalEpoch } from "./journal";
import { saveWithDraft, acknowledgeDraftCommit, type DraftSaveOperation } from "./commit";
import type { DraftPayload, DraftSnapshot } from "./types";
import { draftTargetKey } from "./validation";
import { saveJournalDraft } from "./editor-adapters";
import { blankPrayerAdministration } from "../prayer/PrayerAdministrationFields";
import { commitMddRestore, generateMddBackup, prepareMddRestore, StaleRestoreReviewError } from "../data/portability";
import { newJournalState } from "./journal";

const databases: Dexie[] = [];
async function setup() { const database = new MddDatabase(`recovery-${crypto.randomUUID()}`); databases.push(database); await prepareDatabase(database); return database; }
async function snapshot(database: MddDatabase, payload: DraftPayload = { kind: "reflection", localDate: "2026-10-07", bodyMd: "Private unfinished writing", baseline: null, pendingReferences: [], dismissedReferences: false }): Promise<DraftSnapshot> {
  const id = crypto.randomUUID(), now = new Date().toISOString();
  return { metadata: { id, formatVersion: 1, kind: payload.kind, targetKey: draftTargetKey(payload, id), journalEpoch: await readJournalEpoch(database), createdAt: now, updatedAt: now, generation: 1, state: "active", context: { returnTo: "/today", reading: null }, lineage: null, commitment: null }, contents: { id, generation: 1, payload } };
}
function next(draft: DraftSnapshot, bodyMd = "Newer text"): DraftSnapshot {
  if (draft.contents.payload.kind !== "reflection") throw new Error("Expected reflection fixture");
  return { metadata: { ...draft.metadata, generation: draft.metadata.generation + 1 }, contents: { ...draft.contents, generation: draft.contents.generation + 1, payload: { ...draft.contents.payload, bodyMd } } };
}
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

describe("approved additive recovery migration", () => {
  it("initializes fresh schema 2 once without creating devotional activity", async () => {
    const database = await setup(), epoch = await readJournalEpoch(database);
    await prepareDatabase(database);
    expect(await readJournalEpoch(database)).toBe(epoch);
    expect(await database.draftJournalState.count()).toBe(1);
    expect(await database.editorDrafts.count()).toBe(0);
    expect(await database.activityEvents.count()).toBe(0);
    expect((await createBackupSnapshot(database)).manifest.schemaVersion).toBe(1);
  });
  it("upgrades original v1 rows without rewriting domain fields", async () => {
    const database = await setup();
    const prayer = await new PrayerRepository(database).createPrayer({ body: "Original saved request" });
    const data = (await createBackupSnapshot(database)).data;
    const name = `legacy-${crypto.randomUUID()}`, legacy = new Dexie(name); databases.push(legacy);
    legacy.version(1).stores(schemaV1); await legacy.open();
    await legacy.transaction("rw", legacy.tables, async () => {
      for (const [table, rows] of Object.entries(data)) await legacy.table(table).bulkAdd(rows);
      await legacy.table("schemaMetadata").add({ key: "database", schemaVersion: 1, contractVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    }); legacy.close();
    const upgraded = new MddDatabase(name); databases.push(upgraded); await prepareDatabase(upgraded);
    expect((await createBackupSnapshot(upgraded)).data).toEqual(data);
    expect(await upgraded.prayers.get(prayer.id)).toEqual(prayer);
    expect(await upgraded.editorDraftContents.count()).toBe(0);
    expect(await upgraded.schemaMetadata.get("database")).toMatchObject({ schemaVersion: 2, contractVersion: 1, createdAt: "2026-01-01T00:00:00.000Z" });
    upgraded.close();
    const downgradeError = await new Promise<DOMException | null>(resolve => {
      const request = indexedDB.open(name, 10); // Dexie v1 uses physical IDB version 10.
      request.onerror = () => { request.onerror = null; resolve(request.error); };
      request.onsuccess = () => { request.result.close(); resolve(null); };
    });
    expect(downgradeError?.name).toBe("VersionError");
  });
  it("rolls an aborted upgrade back to an intact v1 database", async () => {
    const name = `abort-${crypto.randomUUID()}`, legacy = new Dexie(name); databases.push(legacy);
    legacy.version(1).stores(schemaV1); await legacy.open();
    await legacy.table("preferences").add({ key: "theme", value: "dark", updatedAt: "2026-10-07T00:00:00.000Z" }); legacy.close();
    const upgrade = new MddDatabase(name); databases.push(upgrade);
    upgrade.version(2).upgrade(() => { throw new Error("Deliberate migration failure"); });
    await expect(upgrade.open()).rejects.toThrow("Deliberate migration failure");
    await legacy.open();
    expect(legacy.verno).toBe(1);
    expect(await legacy.table("preferences").get("theme")).toMatchObject({ value: "dark" });
    expect(legacy.tables.map(table => table.name)).not.toContain("editorDrafts");
  });
});

describe("private recovery repository", () => {
  it("round-trips every supported editor payload, including incomplete hidden fields and frozen context", async () => {
    const database = await setup(), repository = new DraftRepository(database), baseline = { id: crypto.randomUUID(), revision: 4 };
    const prayerBaseline = { ...baseline, status: "ACTIVE" as const, body: "Saved request" };
    const administration = { ...blankPrayerAdministration("2026-10-07"), intervalDays: "unfinished", anchorDate: "bad date still being edited", monthlyDay: "", eventDate: "2026-10-" };
    const reference = { translationId: "BSB", startVerseKey: "JHN.3.16" as const, endVerseKey: "JHN.3.18" as const };
    const payloads: DraftPayload[] = [
      { kind: "reflection", localDate: "2026-10-07", bodyMd: "", baseline: { ...baseline, bodyMd: "Original" }, pendingReferences: [reference], dismissedReferences: false },
      { kind: "verse-note", reference, bodyMd: "Unfinished", baseline: { ...baseline, bodyMd: "Original" } },
      { kind: "prayer-create", localDate: "2026-10-07", body: "", administration, sourceReflection: baseline, references: [reference], omitSource: true, omitReferences: false },
      { kind: "prayer-wording", body: "", baseline: prayerBaseline },
      { kind: "prayer-update", body: "New", baseline: prayerBaseline },
      { kind: "prayer-encouragement", body: "New", baseline: prayerBaseline },
      { kind: "prayer-answer", body: "", baseline: prayerBaseline, session: { id: crypto.randomUUID(), itemId: crypto.randomUUID(), localDate: "2026-10-07" } },
      { kind: "prayer-settings", administration, baseline: prayerBaseline, schedule: { ...baseline, administration: blankPrayerAdministration("2026-10-07") } },
      { kind: "collection-create", name: "" }, { kind: "collection-rename", name: "", baseline: { ...baseline, name: "Original" } },
      { kind: "collection-item-note", note: "", collection: { id: crypto.randomUUID(), revision: 2 }, baseline: { ...baseline, note: "Original" } },
      { kind: "person-create", name: "", relationship: "Friend", notes: "Private notes" },
      { kind: "person-edit", name: "", relationship: "", notes: "", baseline: { ...baseline, name: "Original", relationship: null, notes: "Private baseline" } },
      { kind: "category-create", name: "" }, { kind: "category-edit", name: "", baseline: { ...baseline, name: "Original" } },
    ];
    const before = (await createBackupSnapshot(database)).data;
    for (const payload of payloads) {
      const draft = await snapshot(database, payload);
      draft.metadata.context = { returnTo: "/history/day/2026-10-07?entry=selected", reading: { enrollmentId: crypto.randomUUID(), assignmentSequence: 280, readingIndex: 0 } };
      await repository.persist(draft, null);
      expect(await repository.read(draft.metadata.id)).toEqual({ kind: "active", snapshot: draft, previousJournal: false });
    }
    expect((await createBackupSnapshot(database)).data).toEqual(before);
    expect(JSON.stringify(await repository.list())).not.toMatch(/Private notes|Private baseline|Unfinished|bad date still being edited/);
  });
  it("keeps, reads and forks writing without changing domain data or exposing list bodies", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    const before = (await createBackupSnapshot(database)).data;
    await repository.persist(draft, null);
    const page = await repository.list(); expect(page.total).toBe(1); expect(JSON.stringify(page)).not.toContain("Private unfinished writing");
    const fork = await repository.forkForRecovery(draft.metadata.id, 1);
    expect(fork.metadata.id).not.toBe(draft.metadata.id);
    expect(fork.metadata.lineage).toEqual({ sourceDraftId: draft.metadata.id, sourceGeneration: 1 });
    expect(await repository.read(draft.metadata.id)).toMatchObject({ kind: "active", previousJournal: false });
    expect((await createBackupSnapshot(database)).data).toEqual(before);
  });
  it("rejects stale checkpoints and missing-ID updates, including after discard", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    await expect(repository.persist(next(draft), 1)).rejects.toMatchObject({ code: "missing" });
    await repository.persist(draft, null); await repository.persist(next(draft), 1);
    await expect(repository.persist(next(draft), 1)).rejects.toMatchObject({ code: "stale" });
    await expect(repository.discard(draft.metadata.id, 1)).rejects.toMatchObject({ code: "stale" });
    await repository.discard(draft.metadata.id, 2);
    await expect(repository.persist(next(next(draft)), 2)).rejects.toMatchObject({ code: "retired" });
    expect(await database.editorDraftContents.count()).toBe(0);
  });
  it("serializes checkpoints and puts discard behind the writer barrier", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    const writer = new DraftWriter(repository, draft.metadata.id);
    const first = writer.checkpoint(draft), second = writer.checkpoint(next(draft));
    await Promise.all([first, second]);
    const third = writer.checkpoint(next(next(draft))), discard = writer.discard();
    await expect(writer.checkpoint(next(next(next(draft))))).rejects.toMatchObject({ code: "retired" });
    await Promise.all([third, discard]);
    expect(await repository.read(draft.metadata.id)).toEqual({ kind: "discarded" });
  });
  it("retains corrupt/unknown data and rejects unsafe return URLs", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    const invalid = structuredClone(draft); invalid.metadata.context.returnTo = "https://example.com";
    await expect(repository.persist(invalid, null)).rejects.toMatchObject({ code: "invalid" });
    await repository.persist(draft, null); await database.editorDraftContents.delete(draft.metadata.id);
    expect(await repository.read(draft.metadata.id)).toEqual({ kind: "invalid" });
    expect(await database.editorDrafts.count()).toBe(1);
    await database.editorDrafts.update(draft.metadata.id, { formatVersion: 99 as 1 });
    expect(await repository.read(draft.metadata.id)).toEqual({ kind: "unsupported" });
    await repository.discard(draft.metadata.id, 1); expect(await database.editorDraftContents.count()).toBe(0);
  });
  it("pages 10,000 metadata rows without reading private bodies", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    const metadata = Array.from({ length: 10_000 }, () => ({ ...draft.metadata, id: crypto.randomUUID() }));
    await database.editorDrafts.bulkAdd(metadata);
    database.editorDraftContents.hook("reading", () => { throw new Error("Directory must not read bodies"); });
    const page = await repository.list({ offset: 9_980, limit: 20 }); expect(page.total).toBe(10_000); expect(page.rows).toHaveLength(20);
    expect(new Set(page.rows.map(row => row.id)).size).toBe(20);
  });
});

function reflectionOperation(database: MddDatabase): DraftSaveOperation {
  const repository = new ReflectionRepository(database);
  return { tables: ["reflections", "devotionDays", "activityEvents", "scriptureLinks"], validate: async payload => {
    if (payload.kind !== "reflection") throw new Error("Wrong editor");
    if (payload.baseline && !await repository.getById(payload.baseline.id)) throw new Error("Removed reflection");
  }, save: async payload => {
    if (payload.kind !== "reflection") throw new Error("Wrong editor");
    const saved = await repository.saveDaily(payload.localDate, payload.bodyMd, payload.baseline?.revision ?? null);
    for (const reference of payload.pendingReferences) if (!payload.dismissedReferences) await repository.attachScripture(saved.reflection.id, reference);
    return { records: [{ id: saved.reflection.id, revision: saved.reflection.revision }], disposition: "editable" };
  }, rebase: (payload, records) => {
    if (payload.kind !== "reflection") throw new Error("Wrong editor");
    return { ...payload, baseline: { ...records[0]!, bodyMd: "Submitted writing" }, pendingReferences: [] };
  } };
}
describe("atomic explicit-save commitment", () => {
  it("never forks copy-only leftover writing into another prayer creation", async () => {
    const database = await setup(), repository = new DraftRepository(database);
    const draft = await snapshot(database, { kind: "prayer-create", localDate: "2026-10-07", body: "Create once", administration: blankPrayerAdministration("2026-10-07"), sourceReflection: null, references: [], omitSource: true, omitReferences: true });
    await repository.persist(draft, null);
    const newer = structuredClone(draft); newer.metadata.generation = 2; newer.contents.generation = 2;
    if (newer.contents.payload.kind === "prayer-create") newer.contents.payload.body = "Copyable newer wording";
    await repository.persist(newer, 1);
    await saveJournalDraft(database, { snapshot: draft, operationId: crypto.randomUUID() });
    await expect(repository.forkForRecovery(draft.metadata.id, 2)).rejects.toMatchObject({ code: "retired" });
    expect(await repository.read(draft.metadata.id)).toMatchObject({ kind: "active", snapshot: { contents: { payload: { body: "Copyable newer wording" } } } });
    expect(await database.prayers.count()).toBe(1); expect(await database.activityEvents.count()).toBe(1);
  });
  it("checkpoints newer memory text after commitment without removing the operation marker", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    await repository.persist(draft, null);
    const context = { snapshot: draft, operationId: crypto.randomUUID() }, result = await saveJournalDraft(database, context);
    const newer = next(draft); if (newer.contents.payload.kind !== "reflection") throw new Error("fixture");
    newer.contents.payload.baseline = { ...result.marker.records[0]!, bodyMd: "Private unfinished writing" };
    await repository.checkpointAfterCommit(newer, 1, context.operationId);
    expect(await repository.read(draft.metadata.id)).toMatchObject({ kind: "active", snapshot: { metadata: { commitment: { operationId: context.operationId } }, contents: { payload: { bodyMd: "Newer text" } } } });
    expect((await saveJournalDraft(database, context)).replayed).toBe(true);
    expect(await database.activityEvents.count()).toBe(1);
    await expect(acknowledgeDraftCommit(database, draft.metadata.id, context.operationId)).rejects.toMatchObject({ code: "stale" });
    await expect(repository.checkpointAfterCommit(next(newer), 1, context.operationId)).rejects.toMatchObject({ code: "stale" });
  });
  it("serializes simultaneous submissions against one durable commitment", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    await repository.persist(draft, null); const context = { snapshot: draft, operationId: crypto.randomUUID() };
    const results = await Promise.all([saveJournalDraft(database, context), saveJournalDraft(database, context)]);
    expect(results.filter(result => result.replayed)).toHaveLength(1);
    expect(await database.reflections.count()).toBe(1); expect(await database.activityEvents.count()).toBe(1);
  });
  it.each(["prayer-create", "prayer-update", "prayer-encouragement", "prayer-answer"] as const)("never repeats %s after commitment before acknowledgment", async kind => {
    const database = await setup(), repository = new DraftRepository(database);
    const prayer = await new PrayerRepository(database).createPrayer({ body: "Original request" });
    const payload: DraftPayload = kind === "prayer-create" ? { kind, localDate: "2026-10-07", body: "New request", administration: blankPrayerAdministration("2026-10-07"), sourceReflection: null, references: [], omitSource: false, omitReferences: false } : kind === "prayer-answer" ? { kind, body: "Answer note", baseline: { id: prayer.id, revision: prayer.revision, status: prayer.status, body: prayer.body }, session: null } : { kind, body: "New update", baseline: { id: prayer.id, revision: prayer.revision, status: prayer.status, body: prayer.body } };
    const draft = await snapshot(database, payload), context = { snapshot: draft, operationId: crypto.randomUUID() };
    await repository.persist(draft, null);
    const first = await saveJournalDraft(database, context), before = (await createBackupSnapshot(database)).data;
    const replay = await saveJournalDraft(database, context);
    expect(replay.replayed).toBe(true); expect(replay.marker).toEqual(first.marker);
    expect((await createBackupSnapshot(database)).data).toEqual(before);
    expect(await database.activityEvents.count()).toBe(2);
    expect(await database.prayerUpdates.count()).toBe(kind === "prayer-update" || kind === "prayer-encouragement" ? 1 : 0);
    expect(await database.prayerResolutions.count()).toBe(kind === "prayer-answer" ? 1 : 0);
  });
  it("rejects a changed or removed prayer without losing the draft", async () => {
    const database = await setup(), repository = new DraftRepository(database), prayers = new PrayerRepository(database);
    const prayer = await prayers.createPrayer({ body: "Request" });
    const draft = await snapshot(database, { kind: "prayer-update", body: "Keep this text", baseline: { id: prayer.id, revision: prayer.revision, status: prayer.status, body: prayer.body } });
    await repository.persist(draft, null); await prayers.removePrayer(prayer.id, prayer.revision);
    await expect(saveJournalDraft(database, { snapshot: draft, operationId: crypto.randomUUID() })).rejects.toMatchObject({ code: "stale" });
    expect(await repository.read(draft.metadata.id)).toMatchObject({ kind: "active" });
    expect(await database.prayerUpdates.count()).toBe(0);
  });
  it("returns a replayable result after commit without duplicating saved writing or events", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database), context = { snapshot: draft, operationId: crypto.randomUUID() };
    await repository.persist(draft, null);
    const first = await saveWithDraft(database, context, reflectionOperation(database));
    expect(first).toMatchObject({ kind: "committed", replayed: false, newerWriting: false });
    expect(await database.editorDraftContents.count()).toBe(0);
    const replay = await saveWithDraft(database, context, reflectionOperation(database)); expect(replay.marker).toEqual(first.marker); expect(replay.replayed).toBe(true);
    expect(await database.reflections.count()).toBe(1); expect(await database.activityEvents.count()).toBe(1);
    const changed = structuredClone(context); changed.snapshot.metadata.generation = 2; changed.snapshot.contents.generation = 2;
    await expect(saveWithDraft(database, changed, reflectionOperation(database))).rejects.toMatchObject({ code: "operation" });
    await acknowledgeDraftCommit(database, draft.metadata.id, context.operationId);
    await expect(repository.persist(next(draft), 1)).rejects.toMatchObject({ code: "missing" });
  });
  it("permits an explicit save when the first independent checkpoint failed", async () => {
    const database = await setup(), draft = await snapshot(database);
    await saveWithDraft(database, { snapshot: draft, operationId: crypto.randomUUID() }, reflectionOperation(database));
    expect(await database.reflections.count()).toBe(1);
    expect(await database.editorDrafts.get(draft.metadata.id)).toMatchObject({ state: "committed" });
  });
  it("rolls domain records and events back if retirement fails", async () => {
    const database = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    await repository.persist(draft, null);
    const fail = () => { throw new Error("Injected retirement failure"); }; database.editorDrafts.hook("updating", fail);
    await expect(saveWithDraft(database, { snapshot: draft, operationId: crypto.randomUUID() }, reflectionOperation(database))).rejects.toThrow("Injected retirement failure");
    database.editorDrafts.hook("updating").unsubscribe(fail);
    expect(await database.reflections.count()).toBe(0); expect(await database.activityEvents.count()).toBe(0);
    expect(await repository.read(draft.metadata.id)).toMatchObject({ kind: "active" });
  });
  it("retains newer generations and never retires a newer source or independent sibling", async () => {
    const database = await setup(), repository = new DraftRepository(database), source = await snapshot(database);
    await repository.persist(source, null); const fork = await repository.forkForRecovery(source.metadata.id, 1);
    await repository.persist(next(source), 1); await repository.persist(next(fork), 1);
    const sibling = await snapshot(database); sibling.metadata.targetKey = source.metadata.targetKey; await repository.persist(sibling, null);
    const result = await saveWithDraft(database, { snapshot: fork, operationId: crypto.randomUUID() }, reflectionOperation(database));
    expect(result.newerWriting).toBe(true);
    expect(await repository.read(source.metadata.id)).toMatchObject({ kind: "active", snapshot: { metadata: { generation: 2 } } });
    expect(await repository.read(sibling.metadata.id)).toMatchObject({ kind: "active" });
    expect(await repository.read(fork.metadata.id)).toMatchObject({ kind: "active", snapshot: { contents: { payload: { bodyMd: "Newer text" } } } });
    await expect(acknowledgeDraftCommit(database, fork.metadata.id, result.marker.operationId)).rejects.toMatchObject({ code: "stale" });
  });
});

describe("restore journal identity", () => {
  it.each(["merge", "replace"] as const)("%s preserves drafts and binds confirmation to the reviewed epoch", async mode => {
    const database = await setup(), source = await setup(), repository = new DraftRepository(database), draft = await snapshot(database);
    await repository.persist(draft, null); const epoch = await readJournalEpoch(database);
    const bytes = (await generateMddBackup(source)).bytes;
    const review = await prepareMddRestore(bytes, "", mode, database);
    await repository.persist(next(draft), 1); // A newer checkpoint does not invalidate review.
    const result = await commitMddRestore(review, database), afterEpoch = await readJournalEpoch(database);
    expect(await repository.read(draft.metadata.id)).toMatchObject({ kind: "active", previousJournal: mode === "replace", snapshot: { metadata: { generation: 2 } } });
    expect(afterEpoch === epoch).toBe(mode === "merge");
    expect(await commitMddRestore(review, database)).toBe(result); expect(await readJournalEpoch(database)).toBe(afterEpoch);
    const nextReview = await prepareMddRestore(bytes, "", mode, database);
    await database.draftJournalState.put(newJournalState());
    await expect(commitMddRestore(nextReview, database)).rejects.toBeInstanceOf(StaleRestoreReviewError);
    await expect(repository.persist(next(next(draft)), 2)).rejects.toMatchObject({ code: "epoch" });
    await expect(repository.forkForRecovery(draft.metadata.id, 2)).rejects.toMatchObject({ code: "epoch" });
  });
});
