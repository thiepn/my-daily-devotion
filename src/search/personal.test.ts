import { afterEach, describe, expect, it } from "vitest";
import { newMutableFields } from "../domain/identity";
import type { LocalDate, ScriptureReference } from "../domain/types";
import { MddDatabase, prepareDatabase } from "../data/database";
import { CollectionRepository } from "../data/repositories/collections";
import { PrayerRepository } from "../data/repositories/prayers";
import { ReflectionRepository } from "../data/repositories/reflections";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import { searchPersonal } from "./personal";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-personal-search-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

const john316: ScriptureReference = { translationId: "BSB", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.16" };

describe("grouped personal search", () => {
  it("finds prayer bodies, updates and answer reflections in the prayer group", async () => {
    const database = testDb(); await prepareDatabase(database);
    const prayers = new PrayerRepository(database);
    const prayer = await prayers.createPrayer({ body: "Pray for the mission team" });
    await prayers.addUpdate(prayer.id, "Visa appointment moved forward");
    await prayers.answer(prayer.id, "God provided the remaining travel funds.");

    const body = await searchPersonal(database, "mission team");
    expect(body.prayers).toHaveLength(1);
    expect(body.prayers[0]).toMatchObject({ id: prayer.id, kind: "Prayer · answered", href: `/prayer/${prayer.id}` });

    const update = await searchPersonal(database, "visa appointment");
    expect(update.prayers).toHaveLength(1);
    expect(update.prayers[0]).toMatchObject({ kind: "Prayer update", href: `/prayer/${prayer.id}` });

    const answer = await searchPersonal(database, "travel funds");
    expect(answer.prayers).toHaveLength(1);
    expect(answer.prayers[0]).toMatchObject({ kind: "Answered prayer", href: `/prayer/${prayer.id}` });
  });

  it("keeps reflections, people and saved Scripture in separate result groups", async () => {
    const database = testDb(); await prepareDatabase(database);
    await new ReflectionRepository(database).saveDaily("2026-09-17" as LocalDate, "Remember the mission field with patience and faith.");
    await database.people.add({ ...newMutableFields(), name: "Daniel Kim", relationship: "Mission teammate", notes: "Preparing for outreach" });
    await new VerseNoteRepository(database).save(john316, "A mission reminder about God's love for the world.");
    const collections = new CollectionRepository(database);
    const collection = await collections.create("Mission passages", "Scripture for mission and outreach");
    await collections.addReference(collection.id, john316, "Use when praying for the mission team");

    const results = await searchPersonal(database, "mission");
    expect(results.reflections.some((item) => item.kind === "Reflection")).toBe(true);
    expect(results.people.some((item) => item.title === "Daniel Kim")).toBe(true);
    expect(results.saved.some((item) => item.kind === "Verse note")).toBe(true);
    expect(results.saved.some((item) => item.kind === "Collection" && item.title === "Mission passages")).toBe(true);
    expect(results.saved.some((item) => item.kind === "Collection note")).toBe(true);
  });

  it("does not surface tombstoned personal records", async () => {
    const database = testDb(); await prepareDatabase(database);
    const prayers = new PrayerRepository(database);
    const prayer = await prayers.createPrayer({ body: "Temporary searchable request" });
    expect((await searchPersonal(database, "temporary searchable")).prayers).toHaveLength(1);
    await prayers.removePrayer(prayer.id);
    expect((await searchPersonal(database, "temporary searchable")).prayers).toHaveLength(0);
  });
});
