# Privacy & Data — My Daily Devotion 1.0

My Daily Devotion is designed as a private, local-first devotional application.

## Where personal data lives

Personal devotional data is stored in the browser's local IndexedDB database on the device/profile running MDD. Version 1.0 does not require an MDD account or cloud database and does not send reflections, prayers, prayer history, reading completion, collections, highlights, bookmarks, or preferences to an MDD server.

The application does not include analytics, advertising, social tracking, or remote fonts in the 1.0 release.

## Network use

The production PWA is self-contained. Its Scripture corpus, Scripture search index, M’Cheyne plan and application assets are bundled for offline use. The production document restricts network connections to the application's own origin.

A first online load/install is needed for the browser to receive the application and complete the service-worker cache. After that validated cache is installed, the core application is designed to cold-start offline.

## Browser storage

Browser storage is not the same as a remote backup. Clearing site data, resetting the browser profile, uninstalling in a way that removes site data, or device loss can remove local devotional records.

MDD requests persistent browser storage when supported, but the browser or operating system remains the final authority over local storage.

## Backups

MDD provides a `.mddbackup` format. A backup can be plain or password-encrypted. Encrypted backups use the application's versioned encryption contract and are validated before live data is modified during restore.

Restore validation checks format/version/checksum, decryption, structure and relational integrity before applying data. Failed validation must leave the current live database untouched.

For meaningful long-term use, keep periodic encrypted backups outside the browser profile.

## Portable export

MDD also provides human-readable/portable export so personal devotional history is not trapped in the application database.

## Scripture data

The bundled Berean Standard Bible source is tracked through the repository's canonical BSB source manifest. The BSB has been public domain since April 30, 2023, as recorded in that canonical source metadata.

## Future services

If a future version adds optional sync, accounts, collaboration or another network service, that release must document the new data flow explicitly. The 1.0 local-first behavior should not be silently converted into remote storage.

## Explicit security boundaries (1.0.1)

Live IndexedDB records are not encrypted by MDD. Password encryption applies only to exported encrypted backup files. A person or program with access to this browser profile may be able to read live records.

Remove uses soft-deletion markers, not secure erasure. Original record text and deleted records can remain in local storage and complete backups. Keep backup files private and manage their retention separately.

Storage is isolated by origin, not URL path. Other applications on the exact same scheme/host/port share this trust boundary. A dedicated MDD origin is recommended for stronger app separation, but moving origin requires explicit export/import; this corrective release does not move the site or clear storage.

Unsaved editor drafts are guarded against navigation and context changes; they are not a guarantee against OS termination. Save meaningful writing and keep periodic encrypted backups.

Duplicate reading-progress repair is non-destructive and idempotent: it retains the newest explicit state, tombstones redundant records, preserves original history, and records repair details in local preferences. Schema remains 1.
