import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import type { ScriptureReference } from "../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-verse-note-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
const reference: ScriptureReference = { translationId: "BSB", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.17" };

describe("VerseNoteRepository", () => {
  it("upserts an exact passage note with stable identity", async () => {
    const database = testDb(); await prepareDatabase(database);
    const repository = new VerseNoteRepository(database);
    const first = await repository.save(reference, "First note");
    const second = await repository.save(reference, "Revised note");
    expect(second.id).toBe(first.id);
    expect(second.revision).toBe(first.revision + 1);
    expect((await repository.getExact(reference))?.bodyMd).toBe("Revised note");
  });

  it("tombstones and later restores the same verse-note identity", async () => {
    const database = testDb(); await prepareDatabase(database);
    const repository = new VerseNoteRepository(database);
    const first = await repository.save(reference, "Keep this context");
    await repository.remove(reference);
    expect(await repository.getExact(reference)).toBeUndefined();
    const restored = await repository.save(reference, "Restored context");
    expect(restored.id).toBe(first.id);
    expect(restored.deletedAt).toBeNull();
  });
});
