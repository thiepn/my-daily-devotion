import { ActivityLog } from "../data/activity";
import { db, type MddDatabase } from "../data/database";
import { newMutableFields, nextMutableFields } from "../domain/identity";
import type {
  Bookmark,
  Highlight,
  ReaderPosition,
  ScriptureReference,
  VerseKey,
} from "../domain/types";

export const BSB_TRANSLATION_ID = "BSB";

export interface ParsedVerseKey {
  bookId: string;
  chapter: number;
  verse: number;
}

export function parseVerseKey(key: VerseKey): ParsedVerseKey {
  const match = /^([1-3]?[A-Z]{2,3})\.([1-9][0-9]*)\.([1-9][0-9]*)$/.exec(key);
  if (!match) throw new Error(`Invalid verse key: ${key}`);
  return { bookId: match[1]!, chapter: Number(match[2]), verse: Number(match[3]) };
}

export function makeVerseKey(bookId: string, chapter: number, verse: number): VerseKey {
  if (!/^[1-3]?[A-Z]{2,3}$/.test(bookId) || chapter < 1 || verse < 1) {
    throw new Error("Invalid Scripture location.");
  }
  return `${bookId}.${chapter}.${verse}` as VerseKey;
}

export function scriptureRange(bookId: string, chapter: number, startVerse: number, endVerse = startVerse): ScriptureReference {
  const start = Math.min(startVerse, endVerse);
  const end = Math.max(startVerse, endVerse);
  return {
    translationId: BSB_TRANSLATION_ID,
    startVerseKey: makeVerseKey(bookId, chapter, start),
    endVerseKey: makeVerseKey(bookId, chapter, end),
  };
}

export function rangeContainsVerse(reference: ScriptureReference, bookId: string, chapter: number, verse: number): boolean {
  const start = parseVerseKey(reference.startVerseKey);
  const end = parseVerseKey(reference.endVerseKey);
  if (start.bookId !== bookId || end.bookId !== bookId) return false;
  const target = chapter * 10000 + verse;
  const low = start.chapter * 10000 + start.verse;
  const high = end.chapter * 10000 + end.verse;
  return target >= Math.min(low, high) && target <= Math.max(low, high);
}

function exactReference(a: ScriptureReference, b: ScriptureReference): boolean {
  return a.translationId === b.translationId && a.startVerseKey === b.startVerseKey && a.endVerseKey === b.endVerseKey;
}

export class ScriptureRepository {
  private readonly activity: ActivityLog;

  constructor(private readonly database: MddDatabase = db) {
    this.activity = new ActivityLog(database);
  }

  private async findReaderPosition(bookId: string, chapter: number): Promise<ReaderPosition | undefined> {
    return this.database.readerPositions
      .filter((item) => item.deletedAt === null && item.translationId === BSB_TRANSLATION_ID && item.bookId === bookId && item.chapter === chapter)
      .first();
  }

  async saveReaderPosition(bookId: string, chapter: number, verseKey: VerseKey | null, offset = 0): Promise<ReaderPosition> {
    return this.database.transaction("rw", this.database.readerPositions, () => this.saveReaderPositionInternal(bookId, chapter, verseKey, offset));
  }

  private async saveReaderPositionInternal(bookId: string, chapter: number, verseKey: VerseKey | null, offset = 0): Promise<ReaderPosition> {
    const current = await this.findReaderPosition(bookId, chapter);

    if (!current) {
      const created: ReaderPosition = {
        ...newMutableFields(),
        translationId: BSB_TRANSLATION_ID,
        bookId,
        chapter,
        verseKey,
        offset,
      };
      await this.database.readerPositions.add(created);
      return created;
    }

    const next: ReaderPosition = {
      ...current,
      ...nextMutableFields(current),
      verseKey,
      offset,
    };
    await this.database.readerPositions.put(next);
    return next;
  }

  async getReaderPosition(bookId: string, chapter: number): Promise<ReaderPosition | undefined> {
    return this.findReaderPosition(bookId, chapter);
  }

  async getResumePosition(): Promise<ReaderPosition | undefined> {
    const positions = await this.database.readerPositions
      .filter((item) => item.deletedAt === null && item.translationId === BSB_TRANSLATION_ID)
      .toArray();
    return positions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async listHighlightsForChapter(bookId: string, chapter: number): Promise<Highlight[]> {
    const items = await this.database.highlights
      .where("translationId")
      .equals(BSB_TRANSLATION_ID)
      .filter((item) => item.deletedAt === null)
      .toArray();
    return items.filter((item) => {
      const start = parseVerseKey(item.startVerseKey);
      const end = parseVerseKey(item.endVerseKey);
      return start.bookId === bookId && end.bookId === bookId && chapter >= Math.min(start.chapter, end.chapter) && chapter <= Math.max(start.chapter, end.chapter);
    });
  }

  async listBookmarksForChapter(bookId: string, chapter: number): Promise<Bookmark[]> {
    const items = await this.database.bookmarks
      .where("translationId")
      .equals(BSB_TRANSLATION_ID)
      .filter((item) => item.deletedAt === null)
      .toArray();
    return items.filter((item) => {
      const start = parseVerseKey(item.startVerseKey);
      const end = parseVerseKey(item.endVerseKey);
      return start.bookId === bookId && end.bookId === bookId && chapter >= Math.min(start.chapter, end.chapter) && chapter <= Math.max(start.chapter, end.chapter);
    });
  }

  async toggleHighlight(reference: ScriptureReference, style = "accent"): Promise<Highlight | null> {
    return this.database.transaction("rw", this.database.highlights, this.database.activityEvents, () => this.toggleHighlightInternal(reference, style));
  }

  private async toggleHighlightInternal(reference: ScriptureReference, style = "accent"): Promise<Highlight | null> {
    const matches = await this.database.highlights
      .where("translationId")
      .equals(reference.translationId)
      .filter((item) => item.deletedAt === null && exactReference(item, reference))
      .toArray();
    const current = matches[0];

    if (current) {
      const next: Highlight = {
        ...current,
        ...nextMutableFields(current),
        deletedAt: new Date().toISOString() as Highlight["deletedAt"],
      };
      await this.database.highlights.put(next);
      return null;
    }

    const created: Highlight = { ...newMutableFields(), ...reference, style };
    await this.database.transaction("rw", this.database.highlights, this.database.activityEvents, async () => {
      await this.database.highlights.add(created);
      await this.activity.record({
        type: "HIGHLIGHT_CREATED",
        subjectType: "highlight",
        subjectId: created.id,
        metadata: {
          translationId: created.translationId,
          startVerseKey: created.startVerseKey,
          endVerseKey: created.endVerseKey,
        },
      });
    });
    return created;
  }

  async toggleBookmark(reference: ScriptureReference, label: string | null = null): Promise<Bookmark | null> {
    return this.database.transaction("rw", this.database.bookmarks, () => this.toggleBookmarkInternal(reference, label));
  }

  private async toggleBookmarkInternal(reference: ScriptureReference, label: string | null = null): Promise<Bookmark | null> {
    const matches = await this.database.bookmarks
      .where("translationId")
      .equals(reference.translationId)
      .filter((item) => item.deletedAt === null && exactReference(item, reference))
      .toArray();
    const current = matches[0];

    if (current) {
      const next: Bookmark = {
        ...current,
        ...nextMutableFields(current),
        deletedAt: new Date().toISOString() as Bookmark["deletedAt"],
      };
      await this.database.bookmarks.put(next);
      return null;
    }

    const created: Bookmark = { ...newMutableFields(), ...reference, label };
    await this.database.bookmarks.add(created);
    return created;
  }
}
