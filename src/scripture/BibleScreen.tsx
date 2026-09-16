import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Bookmark, Highlight, ScriptureReference, VerseKey } from "../domain/types";
import { Icon } from "../app/visual/Icon";
import { loadBibleBook, loadBibleChapter, loadBibleManifest } from "./loader";
import {
  rangeContainsVerse,
  scriptureRange,
  ScriptureRepository,
} from "./repository";
import type { BibleChapterAsset, BibleManifest, BibleManifestBook, ScriptureBlock } from "./types";

interface VerseSelection {
  start: number;
  end: number;
}

const repository = new ScriptureRepository();

function referenceLabel(book: BibleManifestBook, chapter: number, selection: VerseSelection): string {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  return `${book.name} ${chapter}:${start}${start === end ? "" : `–${end}`}`;
}

function rangeEquals(item: ScriptureReference, reference: ScriptureReference): boolean {
  return item.translationId === reference.translationId && item.startVerseKey === reference.startVerseKey && item.endVerseKey === reference.endVerseKey;
}

function joinSelectedText(chapter: BibleChapterAsset, selection: VerseSelection): string {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  return chapter.blocks
    .flatMap((block) => block.segments)
    .filter((segment) => segment.verse !== null && segment.verse >= start && segment.verse <= end)
    .map((segment) => segment.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function BibleScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [chapterData, setChapterData] = useState<BibleChapterAsset | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [selection, setSelection] = useState<VerseSelection | null>(null);
  const [status, setStatus] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const positionTimer = useRef<number | null>(null);
  const restoredLocation = useRef<string | null>(null);

  const routeBookId = (params.bookId ?? "").toUpperCase();
  const routeChapter = Number(params.chapter ?? Number.NaN);
  const activeBook = useMemo(
    () => manifest?.books.find((book) => book.id === routeBookId) ?? null,
    [manifest, routeBookId],
  );
  const validChapter = activeBook !== null && Number.isInteger(routeChapter) && routeChapter >= 1 && routeChapter <= activeBook.chapterCount;

  useEffect(() => {
    let cancelled = false;
    loadBibleManifest()
      .then((value) => { if (!cancelled) setManifest(value); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load the Bible manifest."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    if (!params.bookId || !params.chapter) {
      void repository.getResumePosition().then((position) => {
        if (position) navigate(`/bible/${position.bookId}/${position.chapter}`, { replace: true });
        else navigate("/bible/GEN/1", { replace: true });
      });
      return;
    }
    if (!activeBook || !validChapter) navigate("/bible/GEN/1", { replace: true });
  }, [activeBook, manifest, navigate, params.bookId, params.chapter, validChapter]);

  const refreshAnnotations = useCallback(async () => {
    if (!activeBook || !validChapter) return;
    const [nextHighlights, nextBookmarks] = await Promise.all([
      repository.listHighlightsForChapter(activeBook.id, routeChapter),
      repository.listBookmarksForChapter(activeBook.id, routeChapter),
    ]);
    setHighlights(nextHighlights);
    setBookmarks(nextBookmarks);
  }, [activeBook, routeChapter, validChapter]);

  useEffect(() => {
    if (!activeBook || !validChapter) return;
    let cancelled = false;
    setChapterData(null);
    setSelection(null);
    setMoreOpen(false);
    setError(null);
    Promise.all([
      loadBibleChapter(activeBook.id, routeChapter),
      loadBibleBook(activeBook.id),
      refreshAnnotations(),
    ])
      .then(([chapter]) => { if (!cancelled) setChapterData(chapter); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load this chapter."); });
    return () => { cancelled = true; };
  }, [activeBook, refreshAnnotations, routeChapter, validChapter]);

  useEffect(() => {
    if (!chapterData || !activeBook) return;
    const key = `${activeBook.id}.${routeChapter}`;
    if (restoredLocation.current === key) return;
    restoredLocation.current = key;
    void repository.getReaderPosition(activeBook.id, routeChapter).then((position) => {
      if (!position?.verseKey) return;
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-verse-key="${position.verseKey}"]`)?.scrollIntoView({ block: "center" });
      });
    });
  }, [activeBook, chapterData, routeChapter]);

  useEffect(() => {
    if (!chapterData || !activeBook || !("IntersectionObserver" in window)) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(".scripture-reader [data-verse-key]"));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const verseKey = visible?.target.getAttribute("data-verse-key") as VerseKey | null;
      if (!verseKey) return;
      if (positionTimer.current !== null) window.clearTimeout(positionTimer.current);
      positionTimer.current = window.setTimeout(() => {
        void repository.saveReaderPosition(activeBook.id, routeChapter, verseKey, window.scrollY);
      }, 400);
    }, { rootMargin: "-8% 0px -72% 0px", threshold: 0 });

    nodes.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      if (positionTimer.current !== null) window.clearTimeout(positionTimer.current);
    };
  }, [activeBook, chapterData, routeChapter]);

  if (!manifest || (!activeBook && !error)) {
    return <main className="visual-screen bible-screen"><p className="eyebrow">Scripture reader</p><p className="bible-loading">Opening the Berean Standard Bible…</p></main>;
  }

  if (error) {
    return (
      <main className="visual-screen bible-screen">
        <p className="eyebrow">Scripture reader</p>
        <h1 className="bible-error-title">Bible</h1>
        <p className="bible-error" role="alert">{error}</p>
      </main>
    );
  }

  if (!activeBook || !validChapter || !chapterData) {
    return <main className="visual-screen bible-screen"><p className="eyebrow">Scripture reader</p><p className="bible-loading">Opening {activeBook?.name ?? "Scripture"}…</p></main>;
  }

  const selectedReference = selection ? scriptureRange(activeBook.id, routeChapter, selection.start, selection.end) : null;
  const exactHighlight = selectedReference ? highlights.some((item) => rangeEquals(item, selectedReference)) : false;
  const exactBookmark = selectedReference ? bookmarks.some((item) => rangeEquals(item, selectedReference)) : false;
  const currentIndex = manifest.books.findIndex((book) => book.id === activeBook.id);

  const navigateAdjacent = (direction: -1 | 1) => {
    if (direction < 0) {
      if (routeChapter > 1) navigate(`/bible/${activeBook.id}/${routeChapter - 1}`);
      else if (currentIndex > 0) {
        const previous = manifest.books[currentIndex - 1];
        if (previous) navigate(`/bible/${previous.id}/${previous.chapterCount}`);
      }
      return;
    }
    if (routeChapter < activeBook.chapterCount) navigate(`/bible/${activeBook.id}/${routeChapter + 1}`);
    else {
      const next = manifest.books[currentIndex + 1];
      if (next) navigate(`/bible/${next.id}/1`);
    }
  };

  const chooseVerse = (verse: number) => {
    setStatus("");
    setMoreOpen(false);
    setSelection((current) => {
      if (!current) return { start: verse, end: verse };
      if (current.start === verse && current.end === verse) return null;
      return { start: current.start, end: verse };
    });
  };

  const toggleHighlight = async () => {
    if (!selectedReference) return;
    await repository.toggleHighlight(selectedReference);
    await refreshAnnotations();
    setStatus(exactHighlight ? "Highlight removed." : "Highlighted locally.");
  };

  const toggleBookmark = async () => {
    if (!selectedReference) return;
    await repository.toggleBookmark(selectedReference);
    await refreshAnnotations();
    setStatus(exactBookmark ? "Bookmark removed." : "Bookmarked locally.");
  };

  const copySelection = async () => {
    if (!selection) return;
    const text = joinSelectedText(chapterData, selection);
    const label = referenceLabel(activeBook, routeChapter, selection);
    await navigator.clipboard.writeText(`${text}\n\n${label} — Berean Standard Bible`);
    setStatus("Selection copied.");
    setMoreOpen(false);
  };

  const renderBlock = (block: ScriptureBlock, blockIndex: number) => {
    if (block.kind === "blank") return <div className="scripture-blank" key={blockIndex} aria-hidden="true" />;
    const content = block.segments.map((segment, segmentIndex) => {
      const verse = segment.verse;
      const selected = verse !== null && selection !== null && verse >= Math.min(selection.start, selection.end) && verse <= Math.max(selection.start, selection.end);
      const highlighted = verse !== null && highlights.some((item) => rangeContainsVerse(item, activeBook.id, routeChapter, verse));
      const bookmarked = verse !== null && bookmarks.some((item) => rangeContainsVerse(item, activeBook.id, routeChapter, verse));
      const classes = [
        "scripture-run",
        segment.redLetter ? "is-red-letter" : "",
        highlighted ? "is-highlighted" : "",
        selected ? "is-selected" : "",
        segment.emphasis ? `emphasis-${segment.emphasis}` : "",
      ].filter(Boolean).join(" ");
      return (
        <span className={classes} key={`${blockIndex}-${segmentIndex}`}>
          {segment.isVerseStart && segment.verseKey && verse !== null ? (
            <button
              className={`verse-number${bookmarked ? " is-bookmarked" : ""}`}
              type="button"
              data-verse-key={segment.verseKey}
              aria-label={`Select ${activeBook.name} ${routeChapter}:${verse}`}
              aria-pressed={selected}
              onClick={() => chooseVerse(verse)}
            >{verse}</button>
          ) : null}
          <span className="scripture-text">{segment.text}</span>
        </span>
      );
    });

    if (block.kind === "heading") return <h3 className={`scripture-heading level-${block.level}`} key={blockIndex}>{content}</h3>;
    if (block.kind === "superscription") return <p className="scripture-superscription" key={blockIndex}>{content}</p>;
    if (block.kind === "poetry") return <p className={`scripture-block scripture-poetry level-${block.level}`} key={blockIndex}>{content}</p>;
    return <p className="scripture-block" key={blockIndex}>{content}</p>;
  };

  const firstChapter = currentIndex === 0 && routeChapter === 1;
  const lastBook = currentIndex === manifest.books.length - 1 && routeChapter === activeBook.chapterCount;

  return (
    <main className="visual-screen bible-screen">
      <header className="screen-heading bible-screen-heading">
        <p className="eyebrow">Scripture reader · BSB</p>
        <h1>Bible</h1>
        <p className="screen-intro">Read the complete Berean Standard Bible in a quiet, semantic reader. Verse actions stay local to this device.</p>
      </header>

      <div className="bible-toolbar" aria-label="Bible navigation">
        <label className="bible-select-label">
          <span>Book</span>
          <select value={activeBook.id} onChange={(event) => navigate(`/bible/${event.target.value}/1`)}>
            {manifest.books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
          </select>
        </label>
        <label className="bible-select-label chapter-select">
          <span>Chapter</span>
          <select value={routeChapter} onChange={(event) => navigate(`/bible/${activeBook.id}/${event.target.value}`)}>
            {Array.from({ length: activeBook.chapterCount }, (_, index) => index + 1).map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
          </select>
        </label>
        <span className="bible-source-note">{manifest.name} · {chapterData.verseCount} verses</span>
      </div>

      <article className="reader-page scripture-reader" aria-label={`${activeBook.name} ${routeChapter}, Berean Standard Bible`}>
        <header className="reader-heading scripture-reader-heading">
          <div>
            <p>Berean Standard Bible</p>
            <h2>{activeBook.name} {routeChapter}</h2>
          </div>
          <span className="reader-context">{activeBook.testament === "OT" ? "Old Testament" : "New Testament"}</span>
        </header>

        <div className="scripture-copy scripture-content">
          {chapterData.blocks.map(renderBlock)}
        </div>

        <nav className="chapter-navigation" aria-label="Adjacent chapters">
          <button type="button" disabled={firstChapter} onClick={() => navigateAdjacent(-1)}><span aria-hidden="true">←</span> Previous</button>
          <span>{activeBook.name} {routeChapter}</span>
          <button type="button" disabled={lastBook} onClick={() => navigateAdjacent(1)}>Next <span aria-hidden="true">→</span></button>
        </nav>
      </article>

      {selection && selectedReference ? (
        <div className="verse-action-dock" role="region" aria-label={`Actions for ${referenceLabel(activeBook, routeChapter, selection)}`}>
          <div className="selection-reference">
            <strong>{referenceLabel(activeBook, routeChapter, selection)}</strong>
            <button type="button" className="clear-selection" onClick={() => setSelection(null)} aria-label="Clear verse selection">×</button>
          </div>
          <div className="verse-actions">
            <button type="button" onClick={() => void toggleHighlight()}>{exactHighlight ? "Remove highlight" : "Highlight"}</button>
            <button type="button" disabled title="Reflection linkage arrives in Phase 5"><Icon name="note" /> Reflect</button>
            <button type="button" disabled title="Prayer capture arrives in Phase 6"><Icon name="prayer" /> Pray</button>
            <button type="button" onClick={() => void toggleBookmark()}><Icon name="bookmark" /> {exactBookmark ? "Remove bookmark" : "Bookmark"}</button>
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}>More</button>
          </div>
          {moreOpen ? <div className="verse-action-menu"><button type="button" onClick={() => void copySelection()}>Copy selection</button></div> : null}
        </div>
      ) : null}

      <p className="reader-status" aria-live="polite">{status}</p>
    </main>
  );
}
