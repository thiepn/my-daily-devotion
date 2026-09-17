import { ActivityLog } from "../activity";
import { assertExpectedRevision } from "../conflicts";
import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import { assertLocalDate } from "../../domain/time";
import { assertPrayerTransition } from "../../domain/prayer";
import type {
  Instant,
  LocalDate,
  Prayer,
  PrayerResolution,
  PrayerSchedule,
  PrayerStatus,
  PrayerUpdate,
  PrayerUpdateType,
  ScriptureLink,
  ScriptureReference,
  UUID,
} from "../../domain/types";
import { normalizePrayerScheduleDraft, type PrayerScheduleDraft } from "../../prayer/scheduling";
import type { MddDatabase } from "../database";
import { MutableRepository } from "./mutable-repository";

export interface NewPrayerInput {
  body: string;
  personId?: UUID | null;
  categoryId?: UUID | null;
  scheduleId?: UUID | null;
  schedule?: PrayerScheduleDraft | null;
  eventDate?: LocalDate | null;
  focusUntil?: LocalDate | null;
  sourceReflectionId?: UUID | null;
  sourceDevotionDate?: LocalDate | null;
  scriptureReferences?: ScriptureReference[];
}

export interface PrayerAdministrationInput {
  personId: UUID | null;
  categoryId: UUID | null;
  eventDate: LocalDate | null;
  focusUntil: LocalDate | null;
  schedule: PrayerScheduleDraft | null;
}

function sameReference(a: ScriptureReference, b: ScriptureReference): boolean {
  return a.translationId === b.translationId && a.startVerseKey === b.startVerseKey && a.endVerseKey === b.endVerseKey;
}

function buildSchedule(draft: PrayerScheduleDraft, at: Instant, existing?: PrayerSchedule): PrayerSchedule {
  const fields = normalizePrayerScheduleDraft(draft);
  if (existing) return { ...existing, ...fields, deletedAt: null, ...nextMutableFields(existing, at) };
  return { ...newMutableFields(at), ...fields };
}

export class PrayerRepository extends MutableRepository<Prayer> {
  private readonly activity: ActivityLog;

  constructor(private readonly database: MddDatabase) {
    super(database.prayers);
    this.activity = new ActivityLog(database);
  }

  async createPrayer(input: NewPrayerInput): Promise<Prayer> {
    const body = input.body.trim();
    if (!body) throw new Error("Prayer body is required.");
    if (input.eventDate) assertLocalDate(input.eventDate);
    if (input.focusUntil) assertLocalDate(input.focusUntil);
    const references = input.scriptureReferences ?? [];
    const at = nowInstant();

    return this.database.transaction(
      "rw",
      [
        this.database.prayers,
        this.database.scriptureLinks,
        this.database.activityEvents,
        this.database.prayerSchedules,
        this.database.people,
        this.database.categories,
      ],
      async () => {
        await this.validateMetadata(input.personId ?? null, input.categoryId ?? null);
        let scheduleId = input.scheduleId ?? null;
        if (input.schedule !== undefined) {
          if (!input.schedule || input.schedule.mode === "ROTATION") scheduleId = null;
          else {
            const schedule = buildSchedule(input.schedule, at);
            await this.database.prayerSchedules.add(schedule);
            scheduleId = schedule.id;
          }
        } else if (scheduleId) {
          const existing = await this.database.prayerSchedules.get(scheduleId);
          if (!existing || existing.deletedAt) throw new Error("Prayer schedule not found.");
        }

        const prayer = await this.create({
          body,
          status: "ACTIVE",
          personId: input.personId ?? null,
          categoryId: input.categoryId ?? null,
          scheduleId,
          eventDate: input.eventDate ?? null,
          focusUntil: input.focusUntil ?? null,
          sourceReflectionId: input.sourceReflectionId ?? null,
          sourceDevotionDate: input.sourceDevotionDate ?? null,
          lastPrayedAt: null,
          archivedAt: null,
        });
        for (const reference of references) await this.attachScripture(prayer.id, reference);
        await this.activity.record({
          type: "PRAYER_CREATED",
          subjectType: "prayer",
          subjectId: prayer.id,
          metadata: {
            sourceReflectionId: prayer.sourceReflectionId,
            sourceDevotionDate: prayer.sourceDevotionDate,
            scriptureLinkCount: references.length,
          },
        });
        return prayer;
      },
    );
  }

  async updateBody(id: UUID, body: string, expectedRevision?: number): Promise<Prayer> {
    const normalized = body.trim();
    if (!normalized) throw new Error("Prayer body is required.");
    return this.database.transaction("rw", this.database.prayers, async () => {
      const current = await this.require(id);
      if (current.status !== "ACTIVE" && current.status !== "WAITING") throw new Error("Answered or archived prayer wording cannot be edited.");
      return this.patch(id, { body: normalized }, expectedRevision);
    });
  }

  async updateAdministration(id: UUID, input: PrayerAdministrationInput, expectedRevision?: number): Promise<Prayer> {
    if (input.eventDate) assertLocalDate(input.eventDate);
    if (input.focusUntil) assertLocalDate(input.focusUntil);
    return this.database.transaction("rw", this.database.prayers, this.database.prayerSchedules, this.database.people, this.database.categories, async () => {
      const prayer = await this.require(id);
      assertExpectedRevision(prayer, expectedRevision);
      if (prayer.status !== "ACTIVE" && prayer.status !== "WAITING") throw new Error("Only active or waiting prayer details can be edited.");
      await this.validateMetadata(input.personId, input.categoryId);
      const existingSchedule = prayer.scheduleId ? await this.database.prayerSchedules.get(prayer.scheduleId) : undefined;
      let scheduleId: UUID | null = null;
      if (input.schedule && input.schedule.mode !== "ROTATION") {
        const at = nowInstant();
        const schedule = buildSchedule(input.schedule, at, existingSchedule && !existingSchedule.deletedAt ? existingSchedule : undefined);
        await this.database.prayerSchedules.put(schedule);
        scheduleId = schedule.id;
      } else if (existingSchedule && !existingSchedule.deletedAt) {
        const at = nowInstant();
        await this.database.prayerSchedules.put({ ...existingSchedule, deletedAt: at, updatedAt: at, revision: existingSchedule.revision + 1 });
      }
      const next: Prayer = {
        ...prayer,
        personId: input.personId,
        categoryId: input.categoryId,
        eventDate: input.eventDate,
        focusUntil: input.focusUntil,
        scheduleId,
        ...nextMutableFields(prayer),
      };
      await this.database.prayers.put(next);
      return next;
    });
  }

  async getScheduleForPrayer(id: UUID): Promise<PrayerSchedule | null> {
    const prayer = await this.get(id);
    if (!prayer?.scheduleId) return null;
    const schedule = await this.database.prayerSchedules.get(prayer.scheduleId);
    return schedule && !schedule.deletedAt ? schedule : null;
  }

  private async validateMetadata(personId: UUID | null, categoryId: UUID | null): Promise<void> {
    if (personId) {
      const person = await this.database.people.get(personId);
      if (!person || person.deletedAt) throw new Error("Selected person is no longer available.");
    }
    if (categoryId) {
      const category = await this.database.categories.get(categoryId);
      if (!category || category.deletedAt) throw new Error("Selected category is no longer available.");
    }
  }

  async listByStatus(status: PrayerStatus): Promise<Prayer[]> {
    const items = await this.database.prayers.where("status").equals(status).filter((item) => item.deletedAt === null).toArray();
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async rotationQueue(limit = Number.POSITIVE_INFINITY): Promise<Prayer[]> {
    const items = await this.database.prayers.where("status").equals("ACTIVE").filter((item) => item.deletedAt === null).toArray();
    items.sort((a, b) => {
      if (a.lastPrayedAt === null && b.lastPrayedAt !== null) return -1;
      if (a.lastPrayedAt !== null && b.lastPrayedAt === null) return 1;
      if (a.lastPrayedAt !== b.lastPrayedAt) return (a.lastPrayedAt ?? "").localeCompare(b.lastPrayedAt ?? "");
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return a.id.localeCompare(b.id);
    });
    return items.slice(0, Number.isFinite(limit) ? Math.max(0, limit) : items.length);
  }

  async transition(id: UUID, status: PrayerStatus): Promise<Prayer> {
    return this.database.transaction("rw", this.database.prayers, async () => {
    const prayer = await this.require(id);
    assertPrayerTransition(prayer.status, status);
    if (status === "ANSWERED") throw new Error("Use answer() so an answered prayer always has a resolution record.");
    const at = nowInstant();
    const next: Prayer = {
      ...prayer,
      status,
      archivedAt: status === "ARCHIVED" ? at : prayer.archivedAt,
      updatedAt: at,
      revision: prayer.revision + 1,
    };
    await this.database.prayers.put(next);
    return next;
    });
  }

  async restoreArchived(id: UUID): Promise<Prayer> {
    return this.database.transaction("rw", this.database.prayers, this.database.prayerResolutions, async () => {
      const prayer = await this.require(id);
      if (prayer.status !== "ARCHIVED") throw new Error("Only archived prayers can be restored.");
      const resolution = await this.getResolution(id);
      const next: Prayer = { ...prayer, status: resolution ? "ANSWERED" : "ACTIVE", archivedAt: null, ...nextMutableFields(prayer) };
      await this.database.prayers.put(next);
      return next;
    });
  }

  async markPrayed(id: UUID, at: Instant = nowInstant()): Promise<Prayer> {
    return this.database.transaction("rw", this.database.prayers, this.database.activityEvents, async () => {
      const prayer = await this.require(id);
      if (prayer.status !== "ACTIVE") throw new Error("Only active prayers can be surfaced in focused prayer.");
      const next: Prayer = { ...prayer, lastPrayedAt: at, ...nextMutableFields(prayer, at) };
      await this.database.prayers.put(next);
      await this.activity.record({ type: "PRAYER_PRAYED", subjectType: "prayer", subjectId: id, metadata: {} });
      return next;
    });
  }

  async addUpdate(id: UUID, body: string, type: PrayerUpdateType = "update", at: Instant = nowInstant()): Promise<PrayerUpdate> {
    const normalized = body.trim();
    if (!normalized) throw new Error("Prayer update text is required.");
    return this.database.transaction("rw", this.database.prayers, this.database.prayerUpdates, this.database.activityEvents, async () => {
      const prayer = await this.require(id);
      if (prayer.status !== "ACTIVE" && prayer.status !== "WAITING") throw new Error("Answered or archived prayers cannot receive new updates.");
      const update: PrayerUpdate = { ...newMutableFields(at), prayerId: id, type, body: normalized, occurredAt: at };
      await this.database.prayerUpdates.add(update);
      await this.database.prayers.put({ ...prayer, ...nextMutableFields(prayer, at) });
      await this.activity.record({
        type: type === "encouragement" ? "ENCOURAGEMENT_RECORDED" : "PRAYER_UPDATED",
        subjectType: "prayerUpdate",
        subjectId: update.id,
        metadata: { prayerId: id },
      });
      return update;
    });
  }

  async listUpdates(id: UUID): Promise<PrayerUpdate[]> {
    const items = await this.database.prayerUpdates.where("prayerId").equals(id).filter((item) => item.deletedAt === null).toArray();
    return items.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  async getResolution(id: UUID): Promise<PrayerResolution | undefined> {
    const item = await this.database.prayerResolutions.where("prayerId").equals(id).first();
    return item && item.deletedAt === null ? item : undefined;
  }

  async answer(id: UUID, reflectionMd: string | null = null, at: Instant = nowInstant()): Promise<{ prayer: Prayer; resolution: PrayerResolution }> {
    return this.database.transaction("rw", this.database.prayers, this.database.prayerResolutions, this.database.activityEvents, async () => {
      const prayer = await this.require(id);
      assertPrayerTransition(prayer.status, "ANSWERED");
      const existingResolution = await this.database.prayerResolutions.where("prayerId").equals(id).first();
      if (existingResolution && !existingResolution.deletedAt) throw new Error(`Prayer already has a resolution: ${id}`);
      const nextPrayer: Prayer = { ...prayer, status: "ANSWERED", updatedAt: at, revision: prayer.revision + 1 };
      const baseResolution: PrayerResolution = {
        ...newMutableFields(at),
        prayerId: id,
        answeredAt: at,
        reflectionMd: reflectionMd?.trim() ? reflectionMd.trim() : null,
      };
      const resolution = existingResolution
        ? { ...baseResolution, id: existingResolution.id, createdAt: existingResolution.createdAt, revision: existingResolution.revision + 1 }
        : baseResolution;
      await this.database.prayers.put(nextPrayer);
      await this.database.prayerResolutions.put(resolution);
      await this.activity.record({ type: "PRAYER_ANSWERED", subjectType: "prayer", subjectId: id, metadata: { resolutionId: resolution.id } });
      return { prayer: nextPrayer, resolution };
    });
  }

  async listScriptureLinks(id: UUID): Promise<ScriptureLink[]> {
    return this.database.scriptureLinks.where("[ownerType+ownerId]").equals(["prayer", id]).filter((item) => item.deletedAt === null).sortBy("createdAt");
  }

  async attachScripture(id: UUID, reference: ScriptureReference): Promise<ScriptureLink> {
    await this.require(id);
    const items = await this.database.scriptureLinks.where("[ownerType+ownerId]").equals(["prayer", id]).toArray();
    const existing = items.find((item) => sameReference(item, reference));
    if (existing) {
      if (existing.deletedAt === null) return existing;
      const restored: ScriptureLink = { ...existing, ...nextMutableFields(existing), deletedAt: null };
      await this.database.scriptureLinks.put(restored);
      return restored;
    }
    const link: ScriptureLink = { ...newMutableFields(), ownerType: "prayer", ownerId: id, ...reference };
    await this.database.scriptureLinks.add(link);
    return link;
  }

  async removePrayer(id: UUID): Promise<void> {
    await this.database.transaction("rw", this.database.prayers, this.database.prayerUpdates, this.database.prayerResolutions, this.database.scriptureLinks, this.database.prayerSchedules, async () => {
      const prayer = await this.require(id);
      const at = nowInstant();
      await this.database.prayers.put({ ...prayer, deletedAt: at, updatedAt: at, revision: prayer.revision + 1 });
      const updates = await this.database.prayerUpdates.where("prayerId").equals(id).filter((item) => item.deletedAt === null).toArray();
      for (const update of updates) await this.database.prayerUpdates.put({ ...update, deletedAt: at, updatedAt: at, revision: update.revision + 1 });
      const resolution = await this.database.prayerResolutions.where("prayerId").equals(id).first();
      if (resolution && resolution.deletedAt === null) await this.database.prayerResolutions.put({ ...resolution, deletedAt: at, updatedAt: at, revision: resolution.revision + 1 });
      const links = await this.listScriptureLinks(id);
      for (const link of links) await this.database.scriptureLinks.put({ ...link, deletedAt: at, updatedAt: at, revision: link.revision + 1 });
      if (prayer.scheduleId) {
        const schedule = await this.database.prayerSchedules.get(prayer.scheduleId);
        if (schedule && !schedule.deletedAt) await this.database.prayerSchedules.put({ ...schedule, deletedAt: at, updatedAt: at, revision: schedule.revision + 1 });
      }
    });
  }
}
