import Dexie, { type EntityTable } from "dexie";
import { repairDuplicateReadingProgress } from "./repairs";
import type {
  ActivityEvent,
  Bookmark,
  Category,
  Collection,
  CollectionItem,
  DevotionDay,
  Highlight,
  Person,
  PlanEnrollment,
  Prayer,
  PrayerResolution,
  PrayerSchedule,
  PrayerSession,
  PrayerSessionItem,
  PrayerUpdate,
  Preference,
  ReaderPosition,
  ReadingProgress,
  Reflection,
  SchemaMetadata,
  ScriptureLink,
  VerseNote,
} from "../domain/types";
import { nowInstant } from "../domain/identity";
import { registerDatabaseVersions } from "./migrations";
import { DATABASE_NAME, DATABASE_SCHEMA_VERSION, DOMAIN_CONTRACT_VERSION } from "./schema";

export class MddDatabase extends Dexie {
  devotionDays!: EntityTable<DevotionDay, "id">;
  reflections!: EntityTable<Reflection, "id">;
  highlights!: EntityTable<Highlight, "id">;
  bookmarks!: EntityTable<Bookmark, "id">;
  verseNotes!: EntityTable<VerseNote, "id">;
  collections!: EntityTable<Collection, "id">;
  collectionItems!: EntityTable<CollectionItem, "id">;
  scriptureLinks!: EntityTable<ScriptureLink, "id">;
  planEnrollments!: EntityTable<PlanEnrollment, "id">;
  readingProgress!: EntityTable<ReadingProgress, "id">;
  readerPositions!: EntityTable<ReaderPosition, "id">;
  prayers!: EntityTable<Prayer, "id">;
  prayerUpdates!: EntityTable<PrayerUpdate, "id">;
  prayerResolutions!: EntityTable<PrayerResolution, "id">;
  prayerSchedules!: EntityTable<PrayerSchedule, "id">;
  prayerSessions!: EntityTable<PrayerSession, "id">;
  prayerSessionItems!: EntityTable<PrayerSessionItem, "id">;
  people!: EntityTable<Person, "id">;
  categories!: EntityTable<Category, "id">;
  activityEvents!: EntityTable<ActivityEvent, "id">;
  preferences!: EntityTable<Preference, "key">;
  schemaMetadata!: EntityTable<SchemaMetadata, "key">;

  constructor(name = DATABASE_NAME) {
    super(name);
    registerDatabaseVersions(this);
  }
}

export const db = new MddDatabase();

export async function prepareDatabase(database: MddDatabase = db): Promise<void> {
  await database.open();
  const current = await database.schemaMetadata.get("database");
  const now = nowInstant();

  if (!current) {
    await database.schemaMetadata.put({
      key: "database",
      schemaVersion: DATABASE_SCHEMA_VERSION,
      contractVersion: DOMAIN_CONTRACT_VERSION,
      createdAt: now,
      updatedAt: now,
    });
    await repairDuplicateReadingProgress(database);
    return;
  }

  if (current.schemaVersion > DATABASE_SCHEMA_VERSION) {
    throw new Error(`Database schema ${current.schemaVersion} is newer than this app supports (${DATABASE_SCHEMA_VERSION}).`);
  }

  if (current.contractVersion !== DOMAIN_CONTRACT_VERSION) {
    throw new Error(`Domain contract mismatch: database=${current.contractVersion}, app=${DOMAIN_CONTRACT_VERSION}.`);
  }

  if (current.schemaVersion < DATABASE_SCHEMA_VERSION) {
    await database.schemaMetadata.put({
      ...current,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      updatedAt: now,
    });
  }
  await repairDuplicateReadingProgress(database);
}
