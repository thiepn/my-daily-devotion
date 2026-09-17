import { assertInstant, assertLocalDate } from "../domain/time";
import { normalizePrayerScheduleDraft } from "../prayer/scheduling";
import referenceLimits from "../scripture/reference-limits.json";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string";
const nonempty = (value: unknown) => text(value) && (value as string).trim().length > 0;
const integer = (value: unknown) => Number.isSafeInteger(value);
const nullable = (check: (value: unknown) => boolean) => (value: unknown) => value === null || check(value);
const oneOf = (...values: unknown[]) => (value: unknown) => values.includes(value);
const date = (value: unknown) => { try { if (!text(value)) return false; assertLocalDate(value as string); return true; } catch { return false; } };
const instant = (value: unknown) => { try { if (!text(value)) return false; assertInstant(value as string); return true; } catch { return false; } };
const bounded = (min: number, max: number) => (value: unknown) => integer(value) && Number(value) >= min && Number(value) <= max;
const limits: Record<string, number[]> = referenceLimits;
const verse = (value: unknown) => {
  if (typeof value !== "string" || !/^(?:[1-3]?[A-Z]{2,3})\.[1-9]\d*\.[1-9]\d*$/.test(value)) return false;
  const [book, chapter, number] = value.split(".");
  return Number(number) <= (limits[book!]?.[Number(chapter)-1] ?? 0);
};
type Rules = Record<string, (value: unknown) => boolean>;
const reference: Rules = { translationId: oneOf("BSB"), startVerseKey: verse, endVerseKey: verse };
const mutable: Rules = { id: nonempty, createdAt: instant, updatedAt: instant, revision: bounded(1, Number.MAX_SAFE_INTEGER), deletedAt: nullable(instant) };
const rules: Record<string, Rules> = {
  devotionDays: { localDate: date, planEnrollmentId: nullable(nonempty), startedAt: instant, lastActiveAt: instant },
  reflections: { localDate: date, bodyMd: nonempty, devotionDayId: nonempty },
  highlights: { ...reference, style: nullable(text) },
  bookmarks: { ...reference, label: nullable(text) },
  verseNotes: { ...reference, bodyMd: nonempty },
  collections: { name: nonempty, description: nullable(text), sortOrder: integer },
  collectionItems: { ...reference, collectionId: nonempty, note: nullable(text), sortOrder: integer },
  scriptureLinks: { ...reference, ownerType: oneOf("reflection", "prayer", "prayerUpdate", "verseNote"), ownerId: nonempty },
  planEnrollments: { planId: oneOf("mcheyne-classic"), planVersion: oneOf(1), mode: oneOf("CALENDAR", "SELF_PACED"), startedOn: date, startSequence: bounded(1, 365) },
  readingProgress: { planEnrollmentId: nonempty, assignmentSequence: bounded(1, 365), readingIndex: bounded(0, 3), completedAt: nullable(instant) },
  readerPositions: { translationId: oneOf("BSB"), bookId: nonempty, chapter: bounded(1, 150), verseKey: nullable(verse), offset: (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 },
  prayers: { body: nonempty, status: oneOf("ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"), personId: nullable(nonempty), categoryId: nullable(nonempty), scheduleId: nullable(nonempty), eventDate: nullable(date), focusUntil: nullable(date), sourceReflectionId: nullable(nonempty), sourceDevotionDate: nullable(date), lastPrayedAt: nullable(instant), archivedAt: nullable(instant) },
  prayerUpdates: { prayerId: nonempty, type: oneOf("update", "encouragement"), body: nonempty, occurredAt: instant },
  prayerResolutions: { prayerId: nonempty, answeredAt: instant, reflectionMd: nullable(text) },
  prayerSchedules: { mode: oneOf("ROTATION", "DAILY", "WEEKDAYS", "INTERVAL_DAYS", "MONTHLY", "ON_DATE", "MANUAL_ONLY"), weekdays: (v) => Array.isArray(v) && v.every(bounded(1, 7)), intervalDays: nullable(bounded(1, 3650)), monthlyDay: nullable(bounded(1, 31)), onDate: nullable(date), anchorDate: nullable(date) },
  prayerSessions: { localDate: date, startedAt: instant, endedAt: nullable(instant), depth: oneOf("quick", "regular", "extended") },
  prayerSessionItems: { sessionId: nonempty, prayerId: nonempty, position: bounded(0, Number.MAX_SAFE_INTEGER), surfacedAt: instant, outcome: oneOf(null, "NEXT", "SKIP", "ANSWERED"), actedAt: nullable(instant) },
  people: { name: nonempty, relationship: nullable(text), notes: nullable(text) },
  categories: { name: nonempty, sortOrder: integer },
  activityEvents: { id: nonempty, type: oneOf("READING_COMPLETED", "HIGHLIGHT_CREATED", "REFLECTION_CREATED", "PRAYER_CREATED", "PRAYER_PRAYED", "PRAYER_UPDATED", "ENCOURAGEMENT_RECORDED", "PRAYER_ANSWERED"), localDate: date, occurredAt: instant, timeZone: nonempty, subjectType: nonempty, subjectId: nonempty, metadata: object },
  preferences: { key: nonempty, updatedAt: instant, value: () => true },
};

/** Validate records before IndexedDB can coerce keys or silently replace duplicates. */
export function validateBackupRecords(data: Record<string, unknown[]>): void {
  for (const [table, rows] of Object.entries(data)) {
    const fields = { ...(table === "preferences" || table === "activityEvents" ? {} : mutable), ...rules[table] };
    const keys = new Set<unknown>();
    for (const value of rows) {
      if (!object(value)) throw new Error(`Invalid record in ${table}.`);
      for (const [field, check] of Object.entries(fields)) {
        if (!Object.hasOwn(value, field) || !check(value[field])) throw new Error(`Invalid ${table}.${field} in backup.`);
      }
      const key = value[table === "preferences" ? "key" : "id"];
      if (keys.has(key)) throw new Error(`Duplicate record in ${table}.`);
      keys.add(key);
      if (table === "prayerSchedules") normalizePrayerScheduleDraft(value as unknown as Parameters<typeof normalizePrayerScheduleDraft>[0]);
      if (table === "readerPositions" && (!limits[String(value.bookId)]?.[Number(value.chapter)-1] || (value.verseKey !== null && !String(value.verseKey).startsWith(`${value.bookId}.${value.chapter}.`)))) throw new Error("Invalid reader position in backup.");
      if (table === "preferences" && value.key === "theme-mode" && !["light", "dark", "system"].includes(String(value.value))) throw new Error("Invalid theme preference.");
    }
  }
}

