import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../database";
import { CollectionRepository } from "./collections";
import type { ScriptureReference } from "../../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-collections-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
const reference: ScriptureReference = { translationId: "BSB", startVerseKey: "ROM.8.28", endVerseKey: "ROM.8.28" };

describe("CollectionRepository", () => {
  it("creates Scripture-only collections and deduplicates the same structural range", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new CollectionRepository(database);
    const collection = await repository.create("Promises");
    const first = await repository.addReference(collection.id, reference, "Remember this.");
    const second = await repository.addReference(collection.id, reference);
    expect(second.id).toBe(first.id);
    expect(await repository.listItems(collection.id)).toHaveLength(1);
  });

  it("tombstones items and restores their stable identity when re-added", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new CollectionRepository(database);
    const collection = await repository.create("Mission");
    const item = await repository.addReference(collection.id, reference);
    await repository.removeItem(item.id);
    expect(await repository.listItems(collection.id)).toHaveLength(0);
    const restored = await repository.addReference(collection.id, reference);
    expect(restored.id).toBe(item.id);
    expect(restored.deletedAt).toBeNull();
  });

  it("removing a collection tombstones its active items", async () => {
    const database = testDb(); await prepareDatabase(database); const repository = new CollectionRepository(database);
    const collection = await repository.create("Wisdom"); const item = await repository.addReference(collection.id, reference);
    await repository.removeCollection(collection.id);
    expect((await database.collections.get(collection.id))?.deletedAt).not.toBeNull();
    expect((await database.collectionItems.get(item.id))?.deletedAt).not.toBeNull();
  });
});
