# My Daily Devotion 1.2.6 — Native mobile interaction polish

Version 1.2.6 focuses on the remaining interaction details that made the mobile experience feel browser-like even after the visual redesign.

## Shared confirmations

MDD now uses one application-level confirmation sheet for destructive actions and unsaved SPA navigation.

Migrated flows include:

- Bible verse-note discard and removal;
- reflection removal;
- prayer removal and answer-note discard;
- focused-prayer skip/end/cancel with an unsaved answer note;
- collection deletion;
- Prayer People and Categories removal.

The browser's own beforeunload warning remains only for genuine reload/tab-close navigation, where browsers do not allow a custom replacement.

## Back navigation

The phone app-bar Back button now consumes real in-app history when an internal source exists.

A direct-open or deep-linked pushed route still has a deterministic logical-parent fallback, so users are never trapped when there is no useful history entry.

This prevents the previous detail → parent → detail bounce caused by pushing another parent entry onto browser history.

## Route handoff and scrolling

Non-reader route changes clear stale document scroll so a newly pushed screen does not open halfway down because the previous page was scrolled.

The Bible reader is intentionally excluded. Verse targets, plan-reading targets and saved reader positions continue to own Bible scroll restoration.

## Touch feedback

Phone navigation and key interactive surfaces now opt into manipulation touch behavior and suppress the browser tap-highlight artifact while preserving keyboard focus styles.

Pressed feedback remains restrained and consistent with Morning Grace.

## Search keyboard

Search now declares:

- `type="search"`;
- `inputMode="search"`;
- `enterKeyHint="search"`;
- no automatic capitalization or correction.

This gives mobile browsers enough information to present a search-oriented software keyboard.

## Verification

The 1.2.6 interaction suite certifies:

- app-bar Back consumes history without reopening the pushed screen;
- direct-open fallback still works;
- pushed non-reader routes reset stale scroll;
- dirty navigation uses the in-app bottom sheet;
- destructive actions use the shared sheet;
- Search exposes the mobile keyboard contract;
- touch behavior remains mobile-appropriate;
- migrated production flows do not contain `window.confirm()`.

Database schema **1** and backup format **1** remain unchanged.
