# Phase 3 — Scripture Platform

Status: **implemented**

Phase 3 turns the Phase 2 Bible visual prototype into a real local-first Scripture platform while preserving the Phase 0 canonical-data contract and Phase 1 persistence model.

## 1. Canonical BSB build pipeline

The canonical source remains Berean Bible’s current BSB USJ download. For reproducible application builds, the pipeline uses the pinned `BSB-publishing/bsb2usfm` v5.9 `BSB_usj.zip` release asset as a deterministic mirror and verifies its SHA-256 before parsing.

`npm run bible:build` downloads the pinned archive only when matching generated assets are absent, verifies the digest, validates all 66 canonical USFM book identities, and writes normalized per-book assets to `public/bible/books/` plus a provenance-rich manifest.

Generated Scripture assets are build products and are intentionally git-ignored. A production Vite build contains them in `dist/bible/`.

## 2. Semantic normalization

The USJ normalizer does not flatten the Bible into verse-only strings. It preserves reader-relevant structure:

- canonical book, chapter, and verse identity;
- paragraph boundaries;
- section headings;
- poetry lines and indentation levels;
- superscriptions/speaker markers;
- red-letter character spans;
- emphasis metadata;
- footnote/cross-reference text as attached notes.

Verse identity remains `<BOOK>.<chapter>.<verse>` and is independent from translation identity.

## 3. Runtime loading

The browser loads a small Bible manifest first and fetches only the selected normalized book asset. Loaded books are memoized in memory. This keeps initial application JavaScript independent from the multi-megabyte Scripture corpus while ensuring the deployed build contains the complete Bible.

PWA service-worker precaching is still reserved for Phase 10. Phase 3 establishes the static same-origin asset foundation that the later PWA layer will cache for cold-start airplane-mode use.

## 4. Real Bible reader

`/bible` now resumes the most recently used reading position. Canonical routes are `/bible/:bookId/:chapter`.

The reader provides:

- all 66 books;
- chapter selection;
- previous/next chapter navigation across book boundaries;
- semantic headings, prose, poetry, and superscriptions;
- restrained BSB red-letter rendering;
- structural verse identity in the DOM;
- responsive editorial typography inherited from Phase 2.

## 5. Reader position

The existing Phase 1 `readerPositions` store is now active. An `IntersectionObserver` tracks the leading visible verse and debounces persistence to Dexie. Each chapter remembers its latest verse; opening `/bible` resumes the most recently updated position.

Reader position remains separate from reading-plan completion, exactly as required by Phase 0.

## 6. Verse selection and actions

Verse numbers are interactive selectors. Selecting one verse starts a range; selecting another extends the range within the current chapter.

The action bar exposes the final product language:

- Highlight — functional in Phase 3;
- Reflect — visible but deferred to Phase 5;
- Pray — visible but deferred to Phase 6;
- Bookmark — functional in Phase 3;
- More → Copy selection — functional in Phase 3.

Highlights and bookmarks use structural Scripture ranges, persist in Dexie, and survive reloads. Highlight creation emits the canonical `HIGHLIGHT_CREATED` activity event.

## 7. Integrity and tests

Phase 3 adds tests for reader-position revision behavior, highlight toggle behavior, bookmark toggle behavior, and structural range helpers. The Phase 3 verifier also exercises the USJ normalizer with prose, heading, poetry, and red-letter fixtures and audits the complete generated Bible manifest.

## 8. Deliberate non-scope

Phase 3 does not add M’Cheyne plan behavior, Bible search, verse notes, collections, reflection writing, prayer creation, audio, multiple translations, PWA service workers, or cloud sync. Those remain assigned to their later phases.
