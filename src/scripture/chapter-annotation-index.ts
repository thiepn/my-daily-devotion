import type { ScriptureReference } from "../domain/types";
import { parseVerseKey } from "./repository";

/**
 * Compute chapter coverage only when the annotations/chapter change.
 * Scripture rendering may otherwise parse every range for every verse on
 * unrelated UI updates (selection, controls, viewport and status changes).
 * Keep the exact cross-chapter/same-book semantics of rangeContainsVerse.
 */
export function coveredVersesForChapter(
  references: readonly ScriptureReference[],
  bookId: string,
  chapter: number,
  verseCount: number,
): ReadonlySet<number> {
  const covered = new Set<number>();
  if (!bookId || !Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(verseCount) || verseCount < 1) return covered;
  const base = chapter * 10000;
  for (const reference of references) {
    const start = parseVerseKey(reference.startVerseKey);
    const end = parseVerseKey(reference.endVerseKey);
    if (start.bookId !== bookId || end.bookId !== bookId) continue;
    const first = Math.max(base + 1, Math.min(start.chapter * 10000 + start.verse, end.chapter * 10000 + end.verse));
    const last = Math.min(base + verseCount, Math.max(start.chapter * 10000 + start.verse, end.chapter * 10000 + end.verse));
    for (let key = first; key <= last; key++) covered.add(key - base);
  }
  return covered;
}
