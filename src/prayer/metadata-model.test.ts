import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { CategoryRepository, PersonRepository, MetadataReferencedError } from "../data/repositories/prayer-metadata";
import { PrayerRepository } from "../data/repositories/prayers";
import { parseMetadataQuery, readMetadataCounts, readMetadataDirectory, readLinkedPrayers } from "./metadata-model";
const databases: MddDatabase[] = [];
async function setup() { const db = new MddDatabase("metadata-journal-" + crypto.randomUUID()); databases.push(db); await prepareDatabase(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(async table => [table.name, await table.toArray()])); }
describe("People and Categories journal", () => {
  it("reads, searches, counts and pages without writes or note disclosure", async () => {
    const db = await setup(), people = new PersonRepository(db), prayers = new PrayerRepository(db);
    const person = await people.createPerson("Anna Wilson", "Friend", "Private needle");
    for (let i = 0; i < 24; i++) await people.createPerson("Person " + String(i).padStart(2, "0"));
    for (let i = 0; i < 16; i++) { const p = await prayers.createPrayer({ body: "Request " + i, personId: person.id }); await db.prayers.update(p.id, { status: ["ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"][i % 4] as "ACTIVE" }); }
    const removed = await prayers.createPrayer({ body: "Removed private text", personId: person.id }); await prayers.softDelete(removed.id);
    const before = await snapshot(db);
    expect((await readMetadataDirectory(db, "people", parseMetadataQuery(""))).records).toHaveLength(20);
    expect((await readMetadataDirectory(db, "people", parseMetadataQuery("?shown=40"))).records).toHaveLength(25);
    expect((await readMetadataDirectory(db, "people", parseMetadataQuery("?q=FRIEND"))).matching).toBe(1);
    expect((await readMetadataDirectory(db, "people", parseMetadataQuery("?q=needle"))).matching).toBe(0);
    expect(await readMetadataCounts(db, "people", [person.id])).toEqual({ [person.id]: 16 });
    expect((await readLinkedPrayers(db, "people", person.id, 5)).items).toHaveLength(5);
    expect((await readLinkedPrayers(db, "people", person.id, 25)).items).toHaveLength(16);
    expect(await snapshot(db)).toEqual(before);
  });
  it("offers defaults only for an untouched table and never resurrects removed categories", async () => {
    const db = await setup(), repo = new CategoryRepository(db);
    const before = await snapshot(db); expect(await repo.list()).toEqual([]); expect(await snapshot(db)).toEqual(before);
    expect((await readMetadataDirectory(db, "categories", parseMetadataQuery(""))).untouched).toBe(true);
    await Promise.all([repo.ensureDefaults(), repo.ensureDefaults()]);
    expect(await repo.list()).toHaveLength(7);
    for (const item of await repo.list()) await repo.removeCategory(item.id, item.revision);
    await repo.ensureDefaults(); expect(await repo.list()).toHaveLength(0);
    expect((await readMetadataDirectory(db, "categories", parseMetadataQuery(""))).untouched).toBe(false);
  });
  it("preserves duplicate person names, deduplicates categories and avoids unchanged revisions", async () => {
    const db = await setup(), people = new PersonRepository(db), categories = new CategoryRepository(db);
    const person = await people.createPerson("Anna", " Friend ", "Note");
    await people.createPerson("Anna"); expect(await people.list()).toHaveLength(2);
    expect((await people.updatePerson(person.id, { name: " Anna ", relationship: "Friend", notes: "Note" }, 1)).revision).toBe(1);
    const first = await categories.createCategoryResult("Family"), second = await categories.createCategoryResult(" family ");
    expect(first.created).toBe(true); expect(second).toEqual({ record: first.record, created: false });
    expect((await categories.updateCategory(first.record.id, "Family", 1)).revision).toBe(1);
  });
  it("protects links in all statuses, checks revisions and never recreates deleted records", async () => {
    const db = await setup(), people = new PersonRepository(db), prayers = new PrayerRepository(db), categories = new CategoryRepository(db);
    const person = await people.createPerson("Anna"), category = await categories.createCategory("Home");
    const prayer = await prayers.createPrayer({ body: "Hope", personId: person.id, categoryId: category.id });
    for (const status of ["ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"] as const) {
      await db.prayers.update(prayer.id, { status });
      await expect(people.removePerson(person.id, 1)).rejects.toBeInstanceOf(MetadataReferencedError);
      await expect(categories.removeCategory(category.id, 1)).rejects.toBeInstanceOf(MetadataReferencedError);
    }
    await prayers.softDelete(prayer.id);
    await people.updatePerson(person.id, { name: "Anne" }, 1);
    await expect(people.removePerson(person.id, 1)).rejects.toThrow(/another tab/);
    await people.removePerson(person.id, 2);
    await expect(people.updatePerson(person.id, { name: "No resurrection" }, 3)).rejects.toThrow(/not found/);
    expect(await readLinkedPrayers(db, "people", person.id, 5)).toEqual({ items: [], total: 0, available: false });
  });
  it("serializes concurrent assignment and removal without dangling live references", async () => {
    const db = await setup(), people = new PersonRepository(db), prayers = new PrayerRepository(db);
    for (let i = 0; i < 6; i++) {
      const person = await people.createPerson("Race " + i);
      const actions = [() => people.removePerson(person.id, 1), () => prayers.createPrayer({ body: "Request", personId: person.id })];
      const results = await Promise.allSettled((i % 2 ? actions.reverse() : actions).map(action => action()));
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const linked = await db.prayers.where("personId").equals(person.id).count();
      expect(Boolean(await people.get(person.id))).toBe(Boolean(linked));
    }
  });
  it("normalizes optional navigation state and preserves complete safe return context", () => {
    const origin = "/prayer?status=WAITING&person=anna";
    const query = parseMetadataQuery("?q=Anna&entry=person-1&shown=21&prayersShown=6&return=" + encodeURIComponent(origin));
    expect(query).toMatchObject({ q: "Anna", entry: "person-1", shown: 40, prayersShown: 15, returnTo: origin });
    expect(parseMetadataQuery("?entry=../bad&shown=NaN&prayersShown=0&return=//evil")).toMatchObject({ entry: null, shown: 20, prayersShown: 5, returnTo: "/prayer", search: "" });
  });
});
