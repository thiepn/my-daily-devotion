import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "./database";
import { auditDatabase } from "./integrity";
import { createMddBackup, importMddBackup } from "./portability";
import { McheyneRepository } from "../mcheyne/repository";
import { PrayerRepository, type PrayerAdministrationInput } from "./repositories/prayers";
import { PersonRepository, CategoryRepository } from "./repositories/prayer-metadata";
import { CollectionRepository } from "./repositories/collections";
import { newMutableFields } from "../domain/identity";
import type { LocalDate } from "../domain/types";

const opened: MddDatabase[] = [];
async function database() {
  const db = new MddDatabase(`mdd-corrective-${crypto.randomUUID()}`);
  opened.push(db); await prepareDatabase(db); return db;
}
afterEach(async () => { for (const db of opened.splice(0)) { db.close(); await db.delete(); } });
const date = "2026-09-17" as LocalDate;
const administration: PrayerAdministrationInput = { personId: null, categoryId: null, eventDate: null, focusUntil: null, schedule: null };

describe("corrective release — transactional reading progress", () => {
  it("serializes overlapping imports without duplicate logical readings and restores the backup", async () => {
    const db = await database(), repo = new McheyneRepository(db);
    const plan = await repo.enrollCalendar(date, 260);
    const counts = await Promise.all([repo.bulkImportThrough(plan.id, 2), repo.bulkImportThrough(plan.id, 2)]);
    expect(counts.sort((a,b) => a-b)).toEqual([0, 8]);
    expect(await repo.listProgress(plan.id)).toHaveLength(8);
    expect((await auditDatabase(db)).ok).toBe(true);
    const target = await database();
    await importMddBackup(await createMddBackup(db), "", "replace", target);
    expect((await auditDatabase(target)).ok).toBe(true);
    expect(await target.readingProgress.count()).toBe(8);
  });
  it("rolls back new enrollment and preferences when its initial progress import fails", async () => {
    const db = await database(), repo = new McheyneRepository(db);
    await expect(repo.enrollCalendarWithProgress(date, 366)).rejects.toThrow();
    expect(await db.planEnrollments.count()).toBe(0);
    expect(await db.readingProgress.count()).toBe(0);
    expect(await db.preferences.get("mcheyne.activeEnrollmentId")).toBeUndefined();
  });
  it("orders an unread action after an import without losing the explicit undo", async () => {
    const db = await database(), repo = new McheyneRepository(db);
    const plan = await repo.enrollCalendar(date, 1);
    await Promise.all([repo.bulkImportThrough(plan.id, 1), repo.setReadingCompleted(plan.id, 1, 0, false, date)]);
    expect(await repo.listProgress(plan.id)).toHaveLength(4);
    expect((await repo.getReadingProgress(plan.id, 1, 0))?.completedAt).toBeNull();
    expect((await auditDatabase(db)).ok).toBe(true);
  });
  it.each([NaN, Infinity, 1.5, -1, 366])("rejects invalid import sequence %s without changing data", async (sequence) => {
    const db = await database(), repo = new McheyneRepository(db);
    const plan = await repo.enrollCalendar(date, 260);
    await expect(repo.bulkImportThrough(plan.id, sequence)).rejects.toThrow(/sequence/i);
    expect(await db.readingProgress.count()).toBe(0);
    expect((await repo.getEnrollment(plan.id))?.startSequence).toBe(260);
  });
  it("repairs historical duplicates without erasing rows, activity or an explicit newer unread state", async () => {
    const db = await database(), repo = new McheyneRepository(db);
    const plan = await repo.enrollCalendar(date, 1);
    const original = (await repo.setReadingCompleted(plan.id, 1, 0, true, date))!;
    const newer = { ...original, ...newMutableFields(), completedAt: null, updatedAt: "2027-01-01T00:00:00.000Z" as typeof original.updatedAt };
    await db.readingProgress.add(newer);
    expect((await auditDatabase(db)).ok).toBe(false);
    await prepareDatabase(db);
    expect((await auditDatabase(db)).ok).toBe(true);
    expect(await db.readingProgress.count()).toBe(2);
    expect(await db.activityEvents.count()).toBe(1);
    expect((await repo.getReadingProgress(plan.id, 1, 0))?.id).toBe(newer.id);
    expect((await repo.getReadingProgress(plan.id, 1, 0))?.completedAt).toBeNull();
    expect((await db.readingProgress.get(original.id))?.deletedAt).not.toBeNull();
    const snapshot = await db.readingProgress.toArray();
    await prepareDatabase(db);
    expect(await db.readingProgress.toArray()).toEqual(snapshot);
  });
});

describe("corrective release — every stale editor is protected", () => {
  it("rejects stale prayer administration before changing or deleting its newer schedule", async () => {
    const db = await database(), repo = new PrayerRepository(db);
    const prayer = await repo.createPrayer({ body: "Pray for the visit" });
    const newer = await repo.updateAdministration(prayer.id, { ...administration, schedule: { mode: "DAILY" }, eventDate: date }, prayer.revision);
    await expect(repo.updateAdministration(prayer.id, { ...administration, focusUntil: date }, prayer.revision)).rejects.toThrow(/another tab/);
    expect(await repo.get(prayer.id)).toEqual(newer);
    expect((await repo.getScheduleForPrayer(prayer.id))?.mode).toBe("DAILY");
    expect((await auditDatabase(db)).ok).toBe(true);
  });
  it("rejects stale person notes and preserves the latest relationship", async () => {
    const db = await database(), repo = new PersonRepository(db);
    const person = await repo.createPerson("Anna", "Friend", "Original notes");
    const newer = await repo.updatePerson(person.id, { name: "Anna", relationship: "Family", notes: "New notes" }, person.revision);
    await expect(repo.updatePerson(person.id, { name: "Anne", relationship: "Friend", notes: "Original notes" }, person.revision)).rejects.toThrow(/another tab/);
    expect(await repo.get(person.id)).toEqual(newer);
  });
  it("rejects stale category names", async () => {
    const db = await database(), repo = new CategoryRepository(db);
    const category = await repo.createCategory("Outreach");
    await repo.updateCategory(category.id, "Local outreach", category.revision);
    await expect(repo.updateCategory(category.id, "Old title", category.revision)).rejects.toThrow(/another tab/);
    expect((await repo.get(category.id))?.name).toBe("Local outreach");
  });
  it("rejects stale collection names and descriptions", async () => {
    const db = await database(), repo = new CollectionRepository(db);
    const collection = await repo.create("Promises", "Original description");
    await repo.rename(collection.id, "Hope", "New description", collection.revision);
    await expect(repo.rename(collection.id, "Older draft", "Original description", collection.revision)).rejects.toThrow(/another tab/);
    expect((await repo.list())[0]?.description).toBe("New description");
  });
});
