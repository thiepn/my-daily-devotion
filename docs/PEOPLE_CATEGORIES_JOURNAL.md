# People & Categories journal

This release is stacked on `codex/morning-grace-v2-focused-prayer` / PR #19. The dependency was open and draft at implementation time. It changes People and Categories and their directory/navigation primitives. No merge or deployment is included.

## Directory and navigation

`/prayer/people` and `/prayer/categories` accept validated optional `q`, `entry`, `shown`, `prayersShown`, and `return` parameters. Directories start at twenty entries and reveal twenty more. Linked requests start at five and reveal ten more. Selected entries outside the current page/search are explicitly labeled separately from matching counts. People sort by name then ID; Categories retain sort order, name and ID. Notes are only shown within an expanded person and are not searched.

The Prayer library now passes its complete filtered URL into management links. Detail and Settings preserve the expanded directory's query and return context. The existing position helper restores scroll and originating focus after the linked list has loaded. Capture and Settings retain their existing draft guards and explicit assignment behavior.

## Read and write boundaries

`metadata-model.ts` and `metadata-hooks.ts` provide nonpersistent readonly directory, count and linked-prayer models. Counts intersect index primary keys across all four statuses and remove tombstones without materializing prayer bodies. Only visible directory IDs are counted. Linked requests query the association index, check parent availability, exclude prayer tombstones and sort newest-updated first with an ID tie-breaker.

Category listing no longer seeds. The seven suggested names are displayed before the explicit command. Creation checks the entire category table in one transaction, including tombstones, so removed entries are not resurrected. Existing case-insensitive category creation returns the matching record and a truthful existing-category notice.

Update and removal methods retain compatible signatures. Unchanged metadata performs no write. Removal checks expected revision and live prayer references inside the same transaction. Answered and Archived references block removal too; only Active and Waiting assignments are described as editable. Metadata mutations introduce no History events.

## Editing and recovery

One on-demand editor is open at a time. Explicit saves, memory-only draft warnings, the shared save/discard/keep dialog, unload protection and submission locks are retained. Fields are disabled while committing. A queued newer input remains unsaved against the committed record rather than creating another record.

Successful mutations update presentation from committed results. A subsequent failed read offers Retry refresh without repeating creation or mutation. Dirty fields are not replaced by subscriptions. Conflicts show labeled fields for Your changes and Saved version; comparison reads do not write. Adopting a revision is explicit and keeping local changes still requires Save. Concurrent deletion leaves copyable text and disables saving to that record.

Directory, counts, linked requests and edited-record reads fail independently. Missing selections, initial loading, empty directories, search misses and retryable failures are distinct. Unknown counts are not displayed as zero. Foreground and cross-tab changes refresh readonly subscriptions; stale results are ignored.

## Visual ownership

`src/styles/prayer-metadata.css` owns this composition in the existing screens layer. Seventy-six metadata-owned selectors were removed from six legacy stylesheets. Shared tokens, journal headings, dialogs, identity tones, semantic icons and the local botanical ornament are reused. No generated assets or remote dependencies were added.

The directory comes first, with search and a clear Add action. Expanded reading panels contain plain-text notes and linked requests. Editors use warm paper surfaces and document-flow actions. The content column is capped at 760px; mobile retains the approved bottom navigation and botanical accent.

See [visual review](visual/morning-grace-v2/people-categories-design-qa.md) for comparison images, corrected findings and limitations.

## Compatibility and release gates

Schema remains **v1**. No stored fields, UUID format, tombstone behavior, backup format, event types, prayer lifecycle, Scripture identity, scheduling, deterministic queue or service-worker rules changed. Unsaved edits have no termination-recovery guarantee.

Coverage includes all four linked statuses, query normalization, ordering/pagination, duplicate names, explicit category creation, no-op saves, removal/assignment races, conflict comparisons, cross-tab deletion, readonly database snapshots, late input, failed writes, committed saves followed by failed reads, exact return URLs and focus restoration. Existing offline, backup and primary-screen image comparisons remain release gates.

Deterministic candidate images cover 320, 360, 390, 430, 768 and 1440px, dark mode, 200% text, empty and populated directories, long content, expanded requests, editors, confirmations, conflicts, no results and errors. Exact-commit certification evidence is generated outside tracked source and reported on the draft PR.
