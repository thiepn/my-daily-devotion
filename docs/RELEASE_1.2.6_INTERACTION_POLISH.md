# My Daily Devotion 1.2.6 — Mobile Interaction Polish

Version 1.2.6 focuses on how the app behaves in the hand rather than adding another feature system.

## Navigation and scroll

Mobile navigation now treats pushed screens as a stack more deliberately.

- New destinations start at the top instead of inheriting the previous screen's scroll offset.
- The app-bar Back control remembers the source route's previous scroll position and restores it when returning.
- Root-tab navigation remains a fresh destination and starts at the top.

This is especially noticeable when opening Search or Data from a long Bible chapter and returning to the exact place you were reading.

## In-app destructive confirmation

The most visible destructive actions no longer use browser-native confirmation popups.

The following now use MDD's own accessible confirmation dialog:

- removing a Prayer person;
- removing a Prayer category;
- deleting a Scripture collection;
- removing a reflection;
- removing a prayer and its updates.

On phone, the confirmation is rendered as a safe-area-aware bottom sheet with 48px actions. Cancel receives initial focus so destructive confirmation is never the default focused action.

## Touch feedback and focus behavior

Coarse-pointer devices now receive explicit pressed-state feedback for the app bar, bottom navigation, local segmented navigation, reading rows and prayer rows.

Touch actions use `touch-action: manipulation` where appropriate, while browser zoom remains fully enabled.

Mobile text fields also receive scroll margins so focused controls are less likely to sit beneath the sticky app bar or editor action bars.

## Prayer capture

Add Prayer now uses the same compact native loading state as the rest of the pushed-route system.

Hardware keyboard users can press Ctrl+Enter or Cmd+Enter to save a non-empty prayer. Plain Enter remains a newline, and empty keyboard submissions are rejected.

## Compatibility

The release preserves:

- database schema 1;
- backup format 1;
- v1.2.5 native loading/error/draft/conflict states;
- v1.2.4 dense secondary workflows;
- contextual Search/Data return behavior;
- the four root mobile destinations;
- desktop/tablet Morning Grace composition;
- all M’Cheyne, Bible, Prayer and History domain semantics.

## Verification

The dedicated interaction suite certifies:

- route-entry scroll reset;
- source-scroll restoration through app-bar Back;
- custom destructive confirmation;
- 48px mobile confirmation actions;
- safe Cancel-first focus;
- Prayer capture newline and Ctrl/Cmd+Enter behavior;
- sticky primary-action touch targets;
- accessibility and horizontal reflow;
- desktop confirmation composition.
