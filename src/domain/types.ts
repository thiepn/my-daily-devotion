export type UUID = string;
export type LocalDate = `${number}-${number}-${number}`;
export type Instant = `${string}Z`;
export type TimeZoneId = string;
export type VerseKey = `${string}.${number}.${number}`;

export interface MutableEntity {
  id: UUID;
  createdAt: Instant;
  updatedAt: Instant;
  revision: number;
  deletedAt: Instant | null;
}

export interface ScriptureReference {
  translationId: string;
  startVerseKey: VerseKey;
  endVerseKey: VerseKey;
}

export type ScriptureLinkOwnerType = "reflection" | "prayer" | "prayerUpdate" | "verseNote";

export interface ScriptureLink extends MutableEntity, ScriptureReference {
  ownerType: ScriptureLinkOwnerType;
  ownerId: UUID;
}

export interface DevotionDay extends MutableEntity {
  localDate: LocalDate;
  planEnrollmentId: UUID | null;
  startedAt: Instant;
  lastActiveAt: Instant;
}

export interface Reflection extends MutableEntity {
  localDate: LocalDate;
  bodyMd: string;
  devotionDayId: UUID;
}

export interface Highlight extends MutableEntity, ScriptureReference { style: string | null; }
export interface Bookmark extends MutableEntity, ScriptureReference { label: string | null; }
export interface VerseNote extends MutableEntity, ScriptureReference { bodyMd: string; }

export interface Collection extends MutableEntity {
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface CollectionItem extends MutableEntity, ScriptureReference {
  collectionId: UUID;
  note: string | null;
  sortOrder: number;
}

export type ReadingPlanMode = "CALENDAR" | "SELF_PACED";

export interface PlanEnrollment extends MutableEntity {
  planId: string;
  planVersion: number;
  mode: ReadingPlanMode;
  startedOn: LocalDate;
  startSequence: number;
}

export interface ReadingProgress extends MutableEntity {
  planEnrollmentId: UUID;
  assignmentSequence: number;
  readingIndex: number;
  completedAt: Instant | null;
}

export interface ReaderPosition extends MutableEntity {
  translationId: string;
  bookId: string;
  chapter: number;
  verseKey: VerseKey | null;
  offset: number;
}

export type PrayerStatus = "ACTIVE" | "WAITING" | "ANSWERED" | "ARCHIVED";

export interface Prayer extends MutableEntity {
  body: string;
  status: PrayerStatus;
  personId: UUID | null;
  categoryId: UUID | null;
  scheduleId: UUID | null;
  eventDate: LocalDate | null;
  focusUntil: LocalDate | null;
  sourceReflectionId: UUID | null;
  sourceDevotionDate: LocalDate | null;
  lastPrayedAt: Instant | null;
  archivedAt: Instant | null;
}

export type PrayerUpdateType = "update" | "encouragement";

export interface PrayerUpdate extends MutableEntity {
  prayerId: UUID;
  type: PrayerUpdateType;
  body: string;
  occurredAt: Instant;
}

export interface PrayerResolution extends MutableEntity {
  prayerId: UUID;
  answeredAt: Instant;
  reflectionMd: string | null;
}

export type PrayerScheduleMode = "ROTATION" | "DAILY" | "WEEKDAYS" | "INTERVAL_DAYS" | "MONTHLY" | "ON_DATE" | "MANUAL_ONLY";

export interface PrayerSchedule extends MutableEntity {
  mode: PrayerScheduleMode;
  weekdays: number[];
  intervalDays: number | null;
  monthlyDay: number | null;
  onDate: LocalDate | null;
  anchorDate: LocalDate | null;
}

export interface PrayerSession extends MutableEntity {
  localDate: LocalDate;
  startedAt: Instant;
  endedAt: Instant | null;
  depth: "quick" | "regular" | "extended";
}

export type PrayerSessionItemOutcome = "NEXT" | "SKIP" | "ANSWERED";

export interface PrayerSessionItem extends MutableEntity {
  sessionId: UUID;
  prayerId: UUID;
  position: number;
  surfacedAt: Instant;
  outcome: PrayerSessionItemOutcome | null;
  actedAt: Instant | null;
}

export interface Person extends MutableEntity {
  name: string;
  relationship: string | null;
  notes: string | null;
}

export interface Category extends MutableEntity { name: string; sortOrder: number; }

export type ActivityEventType = "READING_COMPLETED" | "HIGHLIGHT_CREATED" | "REFLECTION_CREATED" | "PRAYER_CREATED" | "PRAYER_PRAYED" | "PRAYER_UPDATED" | "ENCOURAGEMENT_RECORDED" | "PRAYER_ANSWERED";

export interface ActivityEvent {
  id: UUID;
  type: ActivityEventType;
  localDate: LocalDate;
  occurredAt: Instant;
  timeZone: TimeZoneId;
  subjectType: string;
  subjectId: string;
  metadata: Record<string, unknown>;
}

export interface Preference { key: string; value: unknown; updatedAt: Instant; }

export interface SchemaMetadata {
  key: "database";
  schemaVersion: number;
  contractVersion: number;
  createdAt: Instant;
  updatedAt: Instant;
}
