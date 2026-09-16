import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";
import type { ActivityEventType, Instant, ScriptureReference } from "../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-prayer-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
const reference: ScriptureReference = { translationId: "BSB", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.17" };

async function expectEventTypes(database: MddDatabase, expected: ActivityEventType[]): Promise<void> {
  const actual = (await database.activityEvents.toArray()).map((item) => item.type);
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
}

describe("PrayerRepository core", () => {
  it("creates a prayer with source Scripture and one creation event", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new PrayerRepository(database);
    const prayer = await repository.createPrayer({ body: "  Pray for wisdom.  ", scriptureReferences: [reference, reference] });
    expect(prayer.body).toBe("Pray for wisdom.");
    expect(await repository.listScriptureLinks(prayer.id)).toHaveLength(1);
    await expectEventTypes(database, ["PRAYER_CREATED"]);
  });

  it("keeps updates and encouragements append-only with meaningful events", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new PrayerRepository(database);
    const prayer = await repository.createPrayer({ body: "A long-running request" });
    await repository.addUpdate(prayer.id, "The situation changed.");
    await repository.addUpdate(prayer.id, "There was a small encouragement.", "encouragement");
    expect((await repository.listUpdates(prayer.id)).map((item) => item.body)).toEqual(["The situation changed.", "There was a small encouragement."]);
    await expectEventTypes(database, ["PRAYER_CREATED", "PRAYER_UPDATED", "ENCOURAGEMENT_RECORDED"]);
  });

  it("builds the basic rotation from active prayers using least-recently-prayed order", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new PrayerRepository(database);
    const prayed = await repository.createPrayer({ body: "Already prayed" });
    const waiting = await repository.createPrayer({ body: "Waiting" });
    const newPrayer = await repository.createPrayer({ body: "Never prayed" });
    await repository.markPrayed(prayed.id, "2026-09-10T10:00:00.000Z" as Instant);
    await repository.transition(waiting.id, "WAITING");
    const queue = await repository.rotationQueue();
    expect(queue.map((item) => item.id)).toEqual([newPrayer.id, prayed.id]);
  });

  it("records Next as prayed while answer creates an atomic resolution and event", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new PrayerRepository(database);
    const prayer = await repository.createPrayer({ body: "Pray for clarity" });
    await repository.markPrayed(prayer.id, "2026-09-16T18:00:00.000Z" as Instant);
    const result = await repository.answer(prayer.id, "The way forward became clear.", "2026-09-16T19:00:00.000Z" as Instant);
    expect(result.prayer.status).toBe("ANSWERED");
    expect(result.resolution.reflectionMd).toBe("The way forward became clear.");
    await expectEventTypes(database, ["PRAYER_CREATED", "PRAYER_PRAYED", "PRAYER_ANSWERED"]);
  });

  it("soft-removes the prayer and its attached child records without erasing activity history", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new PrayerRepository(database);
    const prayer = await repository.createPrayer({ body: "Temporary request", scriptureReferences: [reference] });
    await repository.addUpdate(prayer.id, "One update");
    await repository.removePrayer(prayer.id);
    expect(await repository.get(prayer.id)).toBeUndefined();
    expect((await database.prayerUpdates.where("prayerId").equals(prayer.id).toArray())[0]?.deletedAt).not.toBeNull();
    expect((await database.scriptureLinks.where("[ownerType+ownerId]").equals(["prayer", prayer.id]).toArray())[0]?.deletedAt).not.toBeNull();
    expect(await database.activityEvents.count()).toBe(2);
  });
});
