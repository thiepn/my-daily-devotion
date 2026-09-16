import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { makeVerseKey, rangeContainsVerse, scriptureRange, ScriptureRepository } from "./repository";

const databases: MddDatabase[] = [];

function testDb(): MddDatabase {
  const database = new MddDatabase(`mdd-scripture-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

describe("ScriptureRepository", () => {
  it("persists reader position with a stable identity and monotonic revision", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new ScriptureRepository(database);

    const first = await repository.saveReaderPosition("JHN", 3, makeVerseKey("JHN", 3, 16));
    const second = await repository.saveReaderPosition("JHN", 3, makeVerseKey("JHN", 3, 17));

    expect(second.id).toBe(first.id);
    expect(second.revision).toBe(2);
    expect((await repository.getResumePosition())?.verseKey).toBe("JHN.3.17");
  });

  it("toggles structural highlights and records creation history", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new ScriptureRepository(database);
    const reference = scriptureRange("ROM", 8, 28, 29);

    const created = await repository.toggleHighlight(reference);
    expect(created).not.toBeNull();
    expect(await repository.listHighlightsForChapter("ROM", 8)).toHaveLength(1);
    expect(await database.activityEvents.where("subjectId").equals(created!.id).count()).toBe(1);

    expect(await repository.toggleHighlight(reference)).toBeNull();
    expect(await repository.listHighlightsForChapter("ROM", 8)).toHaveLength(0);
  });

  it("toggles bookmarks without destroying their tombstone history", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new ScriptureRepository(database);
    const reference = scriptureRange("PSA", 23, 1);

    const created = await repository.toggleBookmark(reference);
    expect(created).not.toBeNull();
    expect(await repository.listBookmarksForChapter("PSA", 23)).toHaveLength(1);

    await repository.toggleBookmark(reference);
    expect(await repository.listBookmarksForChapter("PSA", 23)).toHaveLength(0);
    expect((await database.bookmarks.get(created!.id))?.deletedAt).not.toBeNull();
  });
});

describe("Scripture range helpers", () => {
  it("normalizes range direction and matches verses structurally", () => {
    const reference = scriptureRange("GEN", 1, 5, 2);
    expect(reference.startVerseKey).toBe("GEN.1.2");
    expect(reference.endVerseKey).toBe("GEN.1.5");
    expect(rangeContainsVerse(reference, "GEN", 1, 4)).toBe(true);
    expect(rangeContainsVerse(reference, "GEN", 1, 6)).toBe(false);
    expect(rangeContainsVerse(reference, "EXO", 1, 4)).toBe(false);
  });
});
