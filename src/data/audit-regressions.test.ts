import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { MddDatabase, prepareDatabase } from "./database";
import { createBackupSnapshot, sha256Hex } from "./backup";
import { createMddBackup, importMddBackup } from "./portability";
import { PrayerRepository } from "./repositories/prayers";
import { ReflectionRepository } from "./repositories/reflections";
import { PrayerSessionRepository } from "./repositories/prayer-sessions";
import { McheyneRepository } from "../mcheyne/repository";
import { CollectionRepository } from "./repositories/collections";
import { VerseNoteRepository } from "./repositories/verse-notes";
import { CategoryRepository, PersonRepository } from "./repositories/prayer-metadata";
import { ScriptureRepository, scriptureRange } from "../scripture/repository";
import { auditDatabase } from "./integrity";
import { searchPersonal } from "../search/personal";

const databases: MddDatabase[] = [];
async function database() { const db = new MddDatabase(`audit-${crypto.randomUUID()}`); databases.push(db); await prepareDatabase(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });

describe("adversarial data regressions", () => {
  it.each(["missing body", "invalid status", "duplicate identity", "missing revision", "invalid date", "invalid schema", "unknown book", "invalid chapter", "invalid verse"])("rejects checksum-valid %s without changing live data", async (kind) => {
    const db = await database(); await new PrayerRepository(db).createPrayer({ body: "Keep this request" });
    await new VerseNoteRepository(db).save(scriptureRange("JHN", 3, 16), "Keep this note", null);
    const before = await createBackupSnapshot(db);
    const files = unzipSync(await createMddBackup(db));
    const data = JSON.parse(strFromU8(files["data.json"]!));
    const manifest = JSON.parse(strFromU8(files["manifest.json"]!));
    if (kind === "missing body") delete data.prayers[0].body;
    if (kind === "invalid status") data.prayers[0].status = "UNKNOWN";
    if (kind === "duplicate identity") data.prayers.push({ ...data.prayers[0], body: "Silently replace it" });
    if (kind === "missing revision") delete data.prayers[0].revision;
    if (kind === "invalid date") data.prayers[0].eventDate = "2026-02-30";
    if (kind === "invalid schema") manifest.schemaVersion = 0;
    if (kind === "unknown book") data.verseNotes[0].startVerseKey = "UNK.3.16";
    if (kind === "invalid chapter") data.verseNotes[0].startVerseKey = "JHN.99.16";
    if (kind === "invalid verse") data.verseNotes[0].endVerseKey = "JHN.3.999";
    const raw = JSON.stringify(data); files["data.json"] = strToU8(raw);
    manifest.files[0].sha256 = await sha256Hex(raw); manifest.files[0].bytes = files["data.json"].length;
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(importMddBackup(zipSync(files), "", "replace", db)).rejects.toThrow();
    expect((await createBackupSnapshot(db)).data).toEqual(before.data);
  });

  it("records simultaneous reading completion only once", async () => {
    const db = await database(); const repo = new McheyneRepository(db);
    const enrollment = await repo.enrollSelfPaced("2026-09-17");
    await Promise.all(Array.from({ length: 6 }, () => repo.setReadingCompleted(enrollment.id, 1, 0, true)));
    expect(await db.readingProgress.count()).toBe(1);
    expect(await db.activityEvents.where("type").equals("READING_COMPLETED").count()).toBe(1);
  });

  it("preserves the latest reflection when a stale editor saves", async () => {
    const db = await database(); const repo = new ReflectionRepository(db);
    const first = await repo.saveDaily("2026-09-17", "Original", null);
    await repo.saveDaily("2026-09-17", "Latest in another tab", first.reflection.revision);
    await expect(repo.saveDaily("2026-09-17", "Stale editor", first.reflection.revision)).rejects.toThrow("another tab");
    expect((await repo.getDaily("2026-09-17"))?.bodyMd).toBe("Latest in another tab");
  });

  it("cannot answer a prayer through an already ended session", async () => {
    const db = await database(); const prayers = new PrayerRepository(db); const sessions = new PrayerSessionRepository(db);
    const prayer = await prayers.createPrayer({ body: "Preserve active state" });
    const session = await sessions.startOrResume("quick");
    await sessions.endSession(session!.session.id);
    await expect(sessions.answer(session!.session.id, session!.entries[0]!.item.id, "Answer")).rejects.toThrow("no longer open");
    expect((await prayers.get(prayer.id))?.status).toBe("ACTIVE");
    expect(await db.prayerResolutions.count()).toBe(0);
  });

  it("restores archived answers as answered and ordinary requests as active", async () => {
    const db = await database(); const prayers = new PrayerRepository(db);
    const prayer = await prayers.createPrayer({ body: "Remember the answer" });
    await prayers.transition(prayer.id, "ARCHIVED");
    expect((await prayers.restoreArchived(prayer.id)).status).toBe("ACTIVE");
    await prayers.answer(prayer.id, "The answer remains");
    await prayers.transition(prayer.id, "ARCHIVED");
    expect((await prayers.restoreArchived(prayer.id)).status).toBe("ANSWERED");
    expect((await prayers.getResolution(prayer.id))?.reflectionMd).toBe("The answer remains");
  });

  it("serializes collection duplicates, default categories, and verse note saves", async () => {
    const db = await database(); const collections = new CollectionRepository(db); const notes = new VerseNoteRepository(db); const categories = new CategoryRepository(db);
    const created = await Promise.all(Array.from({ length: 5 }, () => collections.create("Promises")));
    expect(new Set(created.map((item) => item.id)).size).toBe(1);
    const reference = scriptureRange("JHN", 3, 16);
    await Promise.all(Array.from({ length: 5 }, () => collections.addReference(created[0]!.id, reference)));
    expect(await db.collectionItems.count()).toBe(1);
    await Promise.all(Array.from({ length: 5 }, () => categories.ensureDefaults()));
    expect(await db.categories.count()).toBe(7);
    const first = await notes.save(reference, "Initial note", null);
    await notes.save(reference, "Newer note", first.revision);
    await expect(notes.save(reference, "Older draft", first.revision)).rejects.toThrow("another tab");
    expect((await notes.getExact(reference))?.bodyMd).toBe("Newer note");
  });

  it("rejects duplicate natural identities and broken date relationships before restore", async () => {
    const db = await database(); const target = await database(); const repo = new McheyneRepository(db);
    const enrollment = await repo.enrollSelfPaced("2026-09-17"); await repo.setReadingCompleted(enrollment.id, 1, 0, true);
    const progress = (await db.readingProgress.toArray())[0]!;
    await db.readingProgress.add({ ...progress, id: crypto.randomUUID() });
    const before = await createBackupSnapshot(target);
    await expect(importMddBackup(await createMddBackup(db), "", "replace", target)).rejects.toThrow("DUPLICATE_READING_PROGRESS");
    expect((await createBackupSnapshot(target)).data).toEqual(before.data);
    await db.readingProgress.clear();
    const reflection = await new ReflectionRepository(db).saveDaily("2026-09-17", "My response");
    await db.devotionDays.update(reflection.reflection.devotionDayId, { localDate: "2026-09-16" });
    await expect(importMddBackup(await createMddBackup(db), "", "replace", target)).rejects.toThrow("REFLECTION_DATE_MISMATCH");
  });

  it("backs up and restores every critical relationship in a fresh database", async () => {
    const source = await database(); const target = await database(); const ref = scriptureRange("JHN", 3, 16);
    const person = await new PersonRepository(source).createPerson("Anna", "Family");
    const category = await new CategoryRepository(source).createCategory("Home");
    const response = await new ReflectionRepository(source).saveDaily("2026-09-17", "A personal reflection", null, ref);
    const prayers = new PrayerRepository(source);
    const prayer = await prayers.createPrayer({ body: "Wisdom for the week", personId: person.id, categoryId: category.id, schedule: { mode: "DAILY" }, sourceReflectionId: response.reflection.id, sourceDevotionDate: response.reflection.localDate, scriptureReferences: [ref] });
    await prayers.addUpdate(prayer.id, "Encouragement", "encouragement");
    const session = await new PrayerSessionRepository(source).startOrResume("quick");
    await new PrayerSessionRepository(source).answer(session!.session.id, session!.entries[0]!.item.id, "We found peace.");
    await new VerseNoteRepository(source).save(ref, "A promise to remember");
    const collection = await new CollectionRepository(source).create("Promises"); await new CollectionRepository(source).addReference(collection.id, ref);
    const scripture = new ScriptureRepository(source); await scripture.toggleHighlight(ref); await scripture.toggleBookmark(ref); await scripture.saveReaderPosition("JHN", 3, "JHN.3.16", 100);
    const plan = new McheyneRepository(source); const enrollment = await plan.enrollSelfPaced("2026-09-17"); await plan.setReadingCompleted(enrollment.id, 1, 0, true);
    await importMddBackup(await createMddBackup(source, "1.0.0", "fixture-passphrase"), "fixture-passphrase", "replace", target);
    expect((await createBackupSnapshot(target)).data).toEqual((await createBackupSnapshot(source)).data);
    expect((await auditDatabase(target)).ok).toBe(true);
    expect((await searchPersonal(target, "Anna")).prayers[0]?.id).toBe(prayer.id);
    expect((await searchPersonal(target, "Home")).prayers[0]?.id).toBe(prayer.id);
  });

  it("does not erase a write made while a restore candidate is being validated", async () => {
    const source = await database(); const target = await database();
    await new PrayerRepository(source).createPrayer({ body: "Incoming" });
    const archive = await createMddBackup(source); let concurrentId = "";
    const original = MddDatabase.prototype.open;
    const hook = vi.spyOn(MddDatabase.prototype, "open").mockImplementation(function (this: MddDatabase) {
      const result = original.call(this);
      if (this.name.startsWith("mdd-import-validation-")) return result.then(async (db) => { concurrentId = (await new PrayerRepository(target).createPrayer({ body: "Written during validation" })).id; return db; }) as typeof result;
      return result;
    });
    try { await expect(importMddBackup(archive, "", "replace", target)).rejects.toThrow("Local data changed"); }
    finally { hook.mockRestore(); }
    expect((await target.prayers.get(concurrentId))?.body).toBe("Written during validation");
    expect(await target.prayers.count()).toBe(1);
  });
});
