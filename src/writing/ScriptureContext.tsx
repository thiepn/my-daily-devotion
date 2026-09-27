import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ScriptureReference } from "../domain/types";
import { loadBibleBook, loadBibleManifest } from "../scripture/loader";
import { parseVerseKey } from "../scripture/repository";
import { prayerReferenceLabel } from "../prayer/references";
import { scriptureTextForRange } from "../scripture/plain-text";

export function scriptureHref(reference: ScriptureReference, returnTo: string): string {
  const start = parseVerseKey(reference.startVerseKey);
  const end = parseVerseKey(reference.endVerseKey);
  const params = new URLSearchParams({ verse: String(start.verse), return: returnTo, translation: reference.translationId, start: reference.startVerseKey, end: reference.endVerseKey });
  if (start.chapter === end.chapter && start.bookId === end.bookId) params.set("endVerse", String(end.verse));
  return `/bible/${start.bookId}/${start.chapter}?${params.toString()}`;
}

export function ScriptureContext({ reference, returnTo, pending = false }: { reference: ScriptureReference; returnTo: string; pending?: boolean }) {
  const [result, setResult] = useState<{ label: string; text: string } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const identity = `${reference.translationId}|${reference.startVerseKey}|${reference.endVerseKey}`;
  useEffect(() => {
    let cancelled = false; setResult(null); setError(false);
    void (async () => {
      if (reference.translationId !== "BSB") throw new Error("Translation unavailable");
      const start = parseVerseKey(reference.startVerseKey); const end = parseVerseKey(reference.endVerseKey);
      const manifest = await loadBibleManifest();
      const first = manifest.books.findIndex(book => book.id === start.bookId);
      const last = manifest.books.findIndex(book => book.id === end.bookId);
      if (first < 0 || last < first) throw new Error("Passage unavailable");
      const parts: string[] = [];
      for (const item of manifest.books.slice(first, last + 1)) {
        const book = await loadBibleBook(item.id);
        for (const chapter of book.chapters) {
          if (item.id === start.bookId && chapter.chapter < start.chapter || item.id === end.bookId && chapter.chapter > end.chapter) continue;
          parts.push(scriptureTextForRange(chapter, item.id === start.bookId && chapter.chapter === start.chapter ? start.verse : 1, item.id === end.bookId && chapter.chapter === end.chapter ? end.verse : chapter.verseCount));
        }
      }
      if (!cancelled) setResult({ label: prayerReferenceLabel(reference, manifest), text: parts.filter(Boolean).join("\n\n") });
    })().catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  // identity describes the immutable reference, so parent renders do not reload assets.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, attempt]);
  return <div className="journal-scripture">
    <Link to={scriptureHref(reference, returnTo)}>{result?.label ?? prayerReferenceLabel(reference, null)}</Link>
    {pending ? <small>Will attach on save</small> : null}
    {result ? <blockquote>{result.text}</blockquote> : error ? <p className="journal-help">Scripture text could not load. Your writing is still available. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry Scripture</button></p> : <p className="journal-help">Opening Scripture…</p>}
  </div>;
}
