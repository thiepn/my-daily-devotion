import type { MddDatabase } from "./database";

export interface IntegrityIssue { code: string; message: string; recordId?: string; }
export interface IntegrityReport { ok: boolean; checkedAt: string; issues: IntegrityIssue[]; counts: Record<string, number>; }

export async function auditDatabase(database: MddDatabase): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = []; const counts: Record<string, number> = {};
  for (const table of database.tables) counts[table.name] = await table.count();

  const activeReflections = await database.reflections.filter((item) => item.deletedAt === null).toArray();
  const reflectionDates = new Map<string, string>();
  for (const reflection of activeReflections) {
    const prior = reflectionDates.get(reflection.localDate);
    if (prior) issues.push({ code: "DUPLICATE_DAILY_REFLECTION", message: `More than one active reflection exists for ${reflection.localDate}.`, recordId: reflection.id });
    else reflectionDates.set(reflection.localDate, reflection.id);
    const day = await database.devotionDays.get(reflection.devotionDayId);
    if (!day || day.deletedAt) issues.push({ code: "ORPHAN_REFLECTION", message: `Reflection ${reflection.id} has no active DevotionDay.`, recordId: reflection.id });
  }

  const activeResolutions = await database.prayerResolutions.filter((item) => item.deletedAt === null).toArray();
  for (const resolution of activeResolutions) {
    const prayer = await database.prayers.get(resolution.prayerId);
    if (!prayer || prayer.deletedAt) issues.push({ code: "ORPHAN_PRAYER_RESOLUTION", message: `Resolution ${resolution.id} has no active prayer.`, recordId: resolution.id });
    else if (prayer.status !== "ANSWERED" && prayer.status !== "ARCHIVED") issues.push({ code: "RESOLUTION_STATUS_MISMATCH", message: `Prayer ${prayer.id} has a resolution but status ${prayer.status}.`, recordId: prayer.id });
  }

  const prayers = await database.prayers.filter((item) => item.deletedAt === null).toArray();
  for (const prayer of prayers) {
    if (prayer.status === "ANSWERED") {
      const resolution = await database.prayerResolutions.where("prayerId").equals(prayer.id).first();
      if (!resolution || resolution.deletedAt) issues.push({ code: "ANSWERED_WITHOUT_RESOLUTION", message: `Answered prayer ${prayer.id} is missing its resolution.`, recordId: prayer.id });
    }
    if (prayer.personId) { const person = await database.people.get(prayer.personId); if (!person || person.deletedAt) issues.push({ code: "ORPHAN_PRAYER_PERSON", message: `Prayer ${prayer.id} points to a missing person.`, recordId: prayer.id }); }
    if (prayer.categoryId) { const category = await database.categories.get(prayer.categoryId); if (!category || category.deletedAt) issues.push({ code: "ORPHAN_PRAYER_CATEGORY", message: `Prayer ${prayer.id} points to a missing category.`, recordId: prayer.id }); }
    if (prayer.scheduleId) { const schedule = await database.prayerSchedules.get(prayer.scheduleId); if (!schedule || schedule.deletedAt) issues.push({ code: "ORPHAN_PRAYER_SCHEDULE", message: `Prayer ${prayer.id} points to a missing schedule.`, recordId: prayer.id }); }
    if (prayer.sourceReflectionId) { const reflection = await database.reflections.get(prayer.sourceReflectionId); if (!reflection) issues.push({ code: "MISSING_PRAYER_SOURCE_REFLECTION", message: `Prayer ${prayer.id} points to a missing source reflection.`, recordId: prayer.id }); }
  }

  const updates = await database.prayerUpdates.filter((item) => item.deletedAt === null).toArray();
  for (const update of updates) { const prayer = await database.prayers.get(update.prayerId); if (!prayer) issues.push({ code: "ORPHAN_PRAYER_UPDATE", message: `PrayerUpdate ${update.id} has no prayer record.`, recordId: update.id }); }

  const links = await database.scriptureLinks.filter((item) => item.deletedAt === null).toArray();
  for (const link of links) {
    let owner: { deletedAt: string | null } | undefined;
    if (link.ownerType === "reflection") owner = await database.reflections.get(link.ownerId);
    if (link.ownerType === "prayer") owner = await database.prayers.get(link.ownerId);
    if (link.ownerType === "prayerUpdate") owner = await database.prayerUpdates.get(link.ownerId);
    if (link.ownerType === "verseNote") owner = await database.verseNotes.get(link.ownerId);
    if (!owner || owner.deletedAt) issues.push({ code: "ORPHAN_SCRIPTURE_LINK", message: `ScriptureLink ${link.id} points to a missing ${link.ownerType}.`, recordId: link.id });
  }

  const collectionItems = await database.collectionItems.filter((item) => item.deletedAt === null).toArray();
  for (const item of collectionItems) { const collection = await database.collections.get(item.collectionId); if (!collection || collection.deletedAt) issues.push({ code: "ORPHAN_COLLECTION_ITEM", message: `CollectionItem ${item.id} has no active collection.`, recordId: item.id }); }

  const progress = await database.readingProgress.filter((item) => item.deletedAt === null).toArray();
  for (const item of progress) { const enrollment = await database.planEnrollments.get(item.planEnrollmentId); if (!enrollment || enrollment.deletedAt) issues.push({ code: "ORPHAN_READING_PROGRESS", message: `ReadingProgress ${item.id} has no active enrollment.`, recordId: item.id }); }

  const sessionItems = await database.prayerSessionItems.filter((item) => item.deletedAt === null).toArray();
  for (const item of sessionItems) { const session = await database.prayerSessions.get(item.sessionId); if (!session || session.deletedAt) issues.push({ code: "ORPHAN_PRAYER_SESSION_ITEM", message: `PrayerSessionItem ${item.id} has no session.`, recordId: item.id }); }

  return { ok: issues.length === 0, checkedAt: new Date().toISOString(), issues, counts };
}
