import type { MddDatabase } from "./database";

export interface IntegrityIssue {
  code: string;
  message: string;
  recordId?: string;
}

export interface IntegrityReport {
  ok: boolean;
  checkedAt: string;
  issues: IntegrityIssue[];
  counts: Record<string, number>;
}

export async function auditDatabase(database: MddDatabase): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = [];
  const counts: Record<string, number> = {};

  for (const table of database.tables) counts[table.name] = await table.count();

  const activeReflections = await database.reflections.filter((item) => item.deletedAt === null).toArray();
  const reflectionDates = new Map<string, string>();
  for (const reflection of activeReflections) {
    const prior = reflectionDates.get(reflection.localDate);
    if (prior) {
      issues.push({ code: "DUPLICATE_DAILY_REFLECTION", message: `More than one active reflection exists for ${reflection.localDate}.`, recordId: reflection.id });
    } else {
      reflectionDates.set(reflection.localDate, reflection.id);
    }
    const day = await database.devotionDays.get(reflection.devotionDayId);
    if (!day || day.deletedAt) issues.push({ code: "ORPHAN_REFLECTION", message: `Reflection ${reflection.id} has no active DevotionDay.`, recordId: reflection.id });
  }

  const activeResolutions = await database.prayerResolutions.filter((item) => item.deletedAt === null).toArray();
  for (const resolution of activeResolutions) {
    const prayer = await database.prayers.get(resolution.prayerId);
    if (!prayer || prayer.deletedAt) {
      issues.push({ code: "ORPHAN_PRAYER_RESOLUTION", message: `Resolution ${resolution.id} has no active prayer.`, recordId: resolution.id });
    } else if (prayer.status !== "ANSWERED" && prayer.status !== "ARCHIVED") {
      issues.push({ code: "RESOLUTION_STATUS_MISMATCH", message: `Prayer ${prayer.id} has a resolution but status ${prayer.status}.`, recordId: prayer.id });
    }
  }

  const answeredPrayers = await database.prayers.filter((item) => item.deletedAt === null && item.status === "ANSWERED").toArray();
  for (const prayer of answeredPrayers) {
    const resolution = await database.prayerResolutions.where("prayerId").equals(prayer.id).first();
    if (!resolution || resolution.deletedAt) issues.push({ code: "ANSWERED_WITHOUT_RESOLUTION", message: `Answered prayer ${prayer.id} is missing its resolution.`, recordId: prayer.id });
  }

  const links = await database.scriptureLinks.filter((item) => item.deletedAt === null).toArray();
  for (const link of links) {
    let owner: { deletedAt: string | null } | undefined;
    if (link.ownerType === "reflection") owner = await database.reflections.get(link.ownerId);
    if (link.ownerType === "prayer") owner = await database.prayers.get(link.ownerId);
    if (link.ownerType === "prayerUpdate") owner = await database.prayerUpdates.get(link.ownerId);
    if (link.ownerType === "verseNote") owner = await database.verseNotes.get(link.ownerId);
    if (!owner || owner.deletedAt) issues.push({ code: "ORPHAN_SCRIPTURE_LINK", message: `ScriptureLink ${link.id} points to a missing ${link.ownerType}.`, recordId: link.id });
  }

  return { ok: issues.length === 0, checkedAt: new Date().toISOString(), issues, counts };
}
