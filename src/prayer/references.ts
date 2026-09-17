import type { ScriptureReference } from "../domain/types";
import { parseVerseKey } from "../scripture/repository";
import type { BibleManifest } from "../scripture/types";

export function prayerReferenceLabel(reference: ScriptureReference, manifest: BibleManifest | null): string {
  const start = parseVerseKey(reference.startVerseKey);
  const end = parseVerseKey(reference.endVerseKey);
  const name = manifest?.books.find((book) => book.id === start.bookId)?.name ?? start.bookId;
  if (start.chapter === end.chapter) return `${name} ${start.chapter}:${start.verse}${start.verse === end.verse ? "" : `–${end.verse}`}`;
  return `${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
}

export function prayerBibleHref(reference: ScriptureReference): string {
  const start = parseVerseKey(reference.startVerseKey);
  return `/bible/${start.bookId}/${start.chapter}?verse=${start.verse}`;
}
