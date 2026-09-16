import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import type { LocalDate, ScriptureReference } from "../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase {
  const database = new MddDatabase(`mdd-reflection-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

const date = "2026-09-16" as LocalDate;
const romans: ScriptureReference = { translationId: "BSB", startVerseKey: "ROM.10.14", endVerseKey: "ROM.10.17" };

describe("ReflectionRepository", () => {
  it("creates one daily reflection, a DevotionDay, and one creation event", async () => {
    const database = testDb(); await prepareDatabase(database);
    const repository = new ReflectionRepository(database);
    const first = await repository.saveDaily(date, "Faith comes by hearing.");
    const second = await repository.saveDaily(date, "Faith comes by hearing the word of Christ.");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.reflection.id).toBe(first.reflection.id);
    expect(second.reflection.revision).toBe(first.reflection.revision + 1);
    expect(await database.devotionDays.count()).toBe(1);
    expect((await database.activityEvents.toArray()).map((event) => event.type)).toEqual(["REFLECTION_CREATED"]);
  });

  it("deduplicates structural Scripture links and can detach them", async () => {
    const database = testDb(); await prepareDatabase(database);
    const repository = new ReflectionRepository(database);
    const reflection = (await repository.saveDaily(date, "A response.")).reflection;
    const first = await repository.attachScripture(reflection.id, romans);
    const second = await repository.attachScripture(reflection.id, romans);
    expect(second.id).toBe(first.id);
    expect(await repository.listScriptureLinks(reflection.id)).toHaveLength(1);
    await repository.detachScripture(first.id);
    expect(await repository.listScriptureLinks(reflection.id)).toHaveLength(0);
  });

  it("tombstones reflection and links without deleting its creation history", async () => {
    const database = testDb(); await prepareDatabase(database);
    const repository = new ReflectionRepository(database);
    const reflection = (await repository.saveDaily(date, "Remember this.")).reflection;
    await repository.attachScripture(reflection.id, romans);
    await repository.removeDaily(date);
    expect(await repository.getDaily(date)).toBeUndefined();
    expect(await repository.listScriptureLinks(reflection.id)).toHaveLength(0);
    expect(await database.activityEvents.count()).toBe(1);
  });
});
