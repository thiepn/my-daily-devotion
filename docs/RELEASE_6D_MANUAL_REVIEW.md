# Manual remembering — weekly review and date ranges

This first Batch D slice adds manually opened `/history/review` and `/history/range`. It does not enable suggestions, anniversaries, backup reminders or notifications. Backup checking and selected-period exports remain subsequent slices; saved versions/removal recovery still require the schema-3 specification review.

Weekly review defaults to the previous completed Monday–Sunday week. Selecting any date opens its containing week; explicitly selected weeks stay selected across midnight/year rollover. Inclusive ranges reject nonexistent or reversed dates and share the same typed range contract for future export selection.

Entries reuse History's stored-local-date grouping, tombstone-aware resolver, semantic rows, selected-Day destination and complete contextual return. Twenty rows are initially available, with twenty more per action and no silent 200-entry cap. The review never writes domain records or recovery stores. Optional Scripture manifest failure leaves personal entries usable.

The approved journal column, botanical ornament, warm dark palette, keyboard focus and mobile navigation are reused. New controls live in the existing History screen composition owner. The overview's primary activity/scenic composition is preserved; manual review links follow its existing content. Full-page screenshots retain fixed navigation at the viewport position, so scrolling reveals longer content.

Supporting checks cover completed-week boundaries, leap day/DST/New Year, inclusive ranges, more than 200 entries, zero-write snapshots, contextual Day/focus return, invalid URLs, dark contrast and 200% narrow reflow. Final release evidence belongs to the exact commit in its draft PR; full certification and human/device usability gates must not be inferred from new screenshot generation.

Compatibility: physical database schema 2, domain contract 1, ordinary portable backup format/schema 1. No new persistent model or History event type.
