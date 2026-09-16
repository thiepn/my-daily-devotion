import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { CategoryRepository, PersonRepository } from "../data/repositories/prayer-metadata";
import { PrayerRepository } from "../data/repositories/prayers";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-metadata-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

describe("prayer people and categories", () => {
  it("seeds the restrained default category set once", async () => {
    const database = testDb(); await prepareDatabase(database); const categories = new CategoryRepository(database);
    expect((await categories.list()).map((item) => item.name)).toEqual(["Personal", "Family", "Friends", "Church", "Mission", "Study/Work", "World"]);
    expect(await database.categories.count()).toBe(7);
    await categories.list(); expect(await database.categories.count()).toBe(7);
  });

  it("keeps Person first-class and prevents removing metadata still used by a prayer", async () => {
    const database = testDb(); await prepareDatabase(database); const people = new PersonRepository(database); const prayers = new PrayerRepository(database);
    const person = await people.createPerson("Anna", "Friend");
    const prayer = await prayers.createPrayer({ body: "Pray for Anna", personId: person.id });
    await expect(people.removePerson(person.id)).rejects.toThrow(/Reassign/);
    await prayers.updateAdministration(prayer.id, { personId: null, categoryId: null, eventDate: null, focusUntil: null, schedule: null });
    await people.removePerson(person.id);
    expect(await people.get(person.id)).toBeUndefined();
  });
});
