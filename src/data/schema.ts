export const DATABASE_NAME = "my-daily-devotion";
export const DATABASE_SCHEMA_VERSION = 1;
export const DOMAIN_CONTRACT_VERSION = 1;

export const schemaV1 = {
  devotionDays: "&id,localDate,planEnrollmentId,startedAt,lastActiveAt,deletedAt",
  reflections: "&id,localDate,devotionDayId,updatedAt,deletedAt",
  highlights: "&id,translationId,startVerseKey,endVerseKey,updatedAt,deletedAt",
  bookmarks: "&id,translationId,startVerseKey,endVerseKey,updatedAt,deletedAt",
  verseNotes: "&id,translationId,startVerseKey,endVerseKey,updatedAt,deletedAt",
  collections: "&id,name,sortOrder,updatedAt,deletedAt",
  collectionItems: "&id,collectionId,translationId,startVerseKey,endVerseKey,sortOrder,deletedAt",
  scriptureLinks: "&id,[ownerType+ownerId],translationId,startVerseKey,endVerseKey,deletedAt",
  planEnrollments: "&id,[planId+planVersion],mode,startedOn,deletedAt",
  readingProgress: "&id,[planEnrollmentId+assignmentSequence+readingIndex],planEnrollmentId,completedAt,deletedAt",
  readerPositions: "&id,[translationId+bookId+chapter],updatedAt,deletedAt",
  prayers: "&id,status,personId,categoryId,scheduleId,eventDate,focusUntil,lastPrayedAt,createdAt,deletedAt",
  prayerUpdates: "&id,prayerId,type,occurredAt,deletedAt",
  prayerResolutions: "&id,&prayerId,answeredAt,deletedAt",
  prayerSchedules: "&id,mode,onDate,anchorDate,deletedAt",
  prayerSessions: "&id,localDate,startedAt,endedAt,deletedAt",
  prayerSessionItems: "&id,[sessionId+position],sessionId,prayerId,outcome,surfacedAt,deletedAt",
  people: "&id,name,updatedAt,deletedAt",
  categories: "&id,name,sortOrder,updatedAt,deletedAt",
  activityEvents: "&id,type,localDate,occurredAt,[subjectType+subjectId],subjectId",
  preferences: "&key,updatedAt",
  schemaMetadata: "&key,schemaVersion,contractVersion",
} as const;
