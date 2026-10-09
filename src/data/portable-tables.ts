import type { MddDatabase } from './database';

/** Portable contracts are independent of the physical database version.
 * Internal recovery/account/sync stores must never enter exports by discovery. */
export const PORTABLE_SCHEMA_VERSION = 1;
export const PORTABLE_CONTRACT_VERSION = 1;
export const PORTABLE_TABLE_NAMES = Object.freeze([
  'devotionDays', 'reflections', 'highlights', 'bookmarks', 'verseNotes',
  'collections', 'collectionItems', 'scriptureLinks', 'planEnrollments',
  'readingProgress', 'readerPositions', 'prayers', 'prayerUpdates',
  'prayerResolutions', 'prayerSchedules', 'prayerSessions', 'prayerSessionItems',
  'people', 'categories', 'activityEvents', 'preferences',
] as const);

export type PortableTableName = typeof PORTABLE_TABLE_NAMES[number];

/** Resolve every required table explicitly; a missing store is an error. */
export function portableTables(database: MddDatabase) {
  return PORTABLE_TABLE_NAMES.map(name => database.table(name));
}
