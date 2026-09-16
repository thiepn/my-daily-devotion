# Phase 5 — Reflection & Scripture Capture

Status: **implemented**

Phase 5 adds MDD’s optional personal-response layer without turning reflection into a required devotional stage or introducing a separate Journal navigation area.

## Daily reflection

MDD keeps one primary reflection per local devotional date. Opening the editor alone creates nothing. A reflection is created only after non-empty text is saved. The first save ensures a thin `DevotionDay` and appends one meaningful `REFLECTION_CREATED` event; later edits update the same stable record and do not create activity noise.

The editor stores restrained Markdown-compatible text. It provides lightweight controls for bold, italic, lists, quotes and links, plus optional prompts that insert into the document only when chosen. Ctrl/Cmd+S is supported. Reflection remains optional regardless of M’Cheyne completion.

Removing a reflection soft-deletes it and its active ScriptureLinks. The original creation event is preserved as history.

## Scripture → Reflection

Selecting a verse or continuous range in the BSB reader now enables **Reflect**. The selected structural BSB range is carried to the dated reflection editor and displayed as pending context. It is attached only when the reflection is actually saved, so opening and cancelling does not mutate user data.

Multiple Scripture passages can be linked to one reflection. Links are stable, deduplicated, removable and stored structurally as translation/start/end verse identities rather than copied verse text.

## Verse Notes

Verse Note is a separate concept from daily reflection. Under the reader’s **More** menu, the selected passage can receive a durable Markdown-compatible note. Exact passage notes are upserted with stable identity, can be removed and restored through tombstones, and do not emit devotional-history events.

Verses covered by a Verse Note receive a restrained visual indicator in the reader.

## Today

The Phase 4 placeholder is replaced by a live reflection panel. Today shows either a calm invitation to write or a short excerpt of the saved reflection plus the number of linked Scripture passages. This remains contextual; there is still no Journal tab.

Reflection is available even before a user enrolls in M’Cheyne.

## Reflection → Prayer handoff

A saved reflection can continue to `/prayer/new` with `sourceReflectionId` and `sourceDevotionDate`. The handoff screen resolves the reflection and its linked Scripture from local data, proving that the source context is preserved. Actual prayer creation remains deliberately disabled until Phase 6, preventing a temporary duplicate prayer implementation.

## Storage and migration

No database migration is required. Phase 5 activates the Phase 1 `reflections`, `verseNotes`, and `scriptureLinks` stores exactly as planned. The database remains schema v1.

## Verification

`npm run verify:phase5` runs every prior phase gate, the full production build, and Phase 5 repository tests. Tests cover one-reflection-per-day behavior, creation-history semantics, ScriptureLink deduplication/detachment, reflection tombstones, Verse Note stable upserts, removal and restoration.
