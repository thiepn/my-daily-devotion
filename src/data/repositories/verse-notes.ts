import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import type { ScriptureReference, VerseNote } from "../../domain/types";
import type { MddDatabase } from "../database";

function sameReference(a: ScriptureReference, b: ScriptureReference): boolean {
  return a.translationId === b.translationId && a.startVerseKey === b.startVerseKey && a.endVerseKey === b.endVerseKey;
}

function locationOf(key: string): { bookId: string; chapter: number } | null {
  const match = /^([1-3]?[A-Z]{2,3})\.([1-9][0-9]*)\.[1-9][0-9]*$/.exec(key);
  return match ? { bookId: match[1]!, chapter: Number(match[2]) } : null;
}

export class VerseNoteRepository {
  constructor(private readonly database: MddDatabase) {}

  private async matches(reference: ScriptureReference): Promise<VerseNote[]> {
    return this.database.verseNotes
      .where("translationId")
      .equals(reference.translationId)
      .filter((item) => sameReference(item, reference))
      .toArray();
  }

  async getExact(reference: ScriptureReference): Promise<VerseNote | undefined> {
    return (await this.matches(reference)).filter((item) => item.deletedAt === null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async listForChapter(bookId: string, chapter: number): Promise<VerseNote[]> {
    const items = await this.database.verseNotes.where("translationId").equals("BSB").filter((item) => item.deletedAt === null).toArray();
    return items.filter((item) => {
      const start = locationOf(item.startVerseKey);
      const end = locationOf(item.endVerseKey);
      return start?.bookId === bookId && end?.bookId === bookId && chapter >= Math.min(start.chapter, end.chapter) && chapter <= Math.max(start.chapter, end.chapter);
    });
  }

  async save(reference: ScriptureReference, bodyMd: string): Promise<VerseNote> {
    const normalized = bodyMd.replace(/\r\n/g, "\n").trimEnd();
    if (!normalized.trim()) throw new Error("Verse note text is required before saving.");
    const matches = await this.matches(reference);
    const existing = matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (existing) {
      const next: VerseNote = { ...existing, ...reference, bodyMd: normalized, deletedAt: null, ...nextMutableFields(existing) };
      await this.database.verseNotes.put(next);
      return next;
    }
    const note: VerseNote = { ...newMutableFields(), ...reference, bodyMd: normalized };
    await this.database.verseNotes.add(note);
    return note;
  }

  async remove(reference: ScriptureReference): Promise<void> {
    const note = await this.getExact(reference);
    if (!note) return;
    await this.database.verseNotes.put({ ...note, ...nextMutableFields(note), deletedAt: nowInstant() });
  }
}
