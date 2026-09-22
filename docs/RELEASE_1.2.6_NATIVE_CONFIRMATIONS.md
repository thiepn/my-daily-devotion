# My Daily Devotion 1.2.6 — Native Confirmations & Keyboard Polish

Version 1.2.6 removes one of the clearest remaining browser-like behaviors from the mobile app: internal `window.confirm` prompts.

## App-owned confirmations

A single confirmation provider now handles internal binary decisions across the app.

Covered workflows include:

- leaving an unsaved editor through app navigation;
- discarding or removing Bible verse notes;
- removing a reflection;
- removing a prayer;
- discarding unsaved answer notes;
- Focused Prayer skip/next/end-session draft protection;
- removing Prayer people or categories;
- deleting Scripture collections.

The safe keep/cancel action receives focus by default. Destructive confirmation requires a separate explicit action.

## Draft safety

The existing three-choice draft sheet remains responsible for workflows that need **Save / Discard / Keep editing**.

Internal route navigation now uses the app confirmation system, while the browser-native `beforeunload` warning remains only for actual reload, tab close or window exit where browsers do not permit custom UI.

## Mobile presentation

On phone, binary confirmations use the same native bottom-sheet language as draft protection:

- bottom-anchored;
- safe-area aware;
- 44px+ actions;
- scrollable on short phones;
- 200% text reflow;
- background scrolling locked while open.

Desktop retains a centered dialog.

## Keyboard and viewport polish

The viewport now opts into `interactive-widget=resizes-content` where supported so Android's virtual keyboard resizes the content viewport rather than simply covering sticky actions.

The phone shell also uses dynamic viewport height and keyboard-safe field scroll margins.

## Compatibility

This release preserves database schema **1**, backup format **1**, offline Scripture assets, M’Cheyne behavior, Prayer scheduling/history semantics and all v1.2.5 mobile-state behavior.
