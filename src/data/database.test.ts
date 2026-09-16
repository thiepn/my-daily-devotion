import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "./database";
import { REGISTERED_SCHEMA_VERSIONS } from "./migrations";
import { DevotionDayRepository } from "./repositories/devotion-days";
import { PrayerRepository } from "./repositories/prayers";
import { ReflectionRepository } from "./repositories/reflections";
import { auditDatabase } from "./integrity";

const openDatabases: MddDatabase[] = [];
function testDb(): MddDatabase {
  const database = new MddDatabase(`mdd-test-${crypto.randomUUID()}`);
  openDatabases.push(database);
  return database;
}

afterEach(async () => {
  for (const database of openDatabases.splice(0)) {
    database.close();
    await database.delete();
  }
});

describe("local database foundation", () => {
  it("registers schema v1 and initializes metadata exactly once", async () => {
    expect(REGISTERED_SCHEMA_VERSIONS).toEqual([1]);
    const database = testDb();
    await prepareDatabase(database);
    await prepareDatabase(database);
    expect(await database.schemaMetadata.count()).toBe(1);
    expect(await database.schemaMetadata.get("database")).toMatchObject({ schemaVersion: 1, contractVersion: 1 });
  });

  it("keeps one primary reflection per devotional date", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const day = await new DevotionDayRepository(database).ensure("2026-09-16");
    const reflections = new ReflectionRepository(database);
    const first = await reflections.upsertDaily("2026-09-16", day.id, "First draft");
    const second = await reflections.upsertDaily("2026-09-16", day.id, "Revised reflection");
    expect(second.id).toBe(first.id);
    expect(second.revision).toBe(2);
    expect(await database.reflections.count()).toBe(1);
  });

  it("answers a prayer atomically with a resolution", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const prayers = new PrayerRepository(database);
    const prayer = await prayers.createPrayer({ body: "Pray for wisdom." });
    const result = await prayers.answer(prayer.id, "A clear answer came.");
    expect(result.prayer.status).toBe("ANSWERED");
    expect(result.resolution.prayerId).toBe(prayer.id);
    expect((await auditDatabase(database)).ok).toBe(true);
  });

  it("tombstones rather than hard-deleting mutable records", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const prayers = new PrayerRepository(database);
    const prayer = await prayers.createPrayer({ body: "Temporary request" });
    const deleted = await prayers.softDelete(prayer.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.revision).toBe(2);
    expect(await prayers.get(prayer.id)).toBeUndefined();
    expect(await prayers.get(prayer.id, true)).toBeDefined();
  });
});
