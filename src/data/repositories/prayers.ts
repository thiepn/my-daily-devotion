import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import { assertPrayerTransition } from "../../domain/prayer";
import type { Instant, LocalDate, Prayer, PrayerResolution, PrayerStatus, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";
import { MutableRepository } from "./mutable-repository";

export interface NewPrayerInput {
  body: string;
  personId?: UUID | null;
  categoryId?: UUID | null;
  scheduleId?: UUID | null;
  eventDate?: LocalDate | null;
  focusUntil?: LocalDate | null;
  sourceReflectionId?: UUID | null;
  sourceDevotionDate?: LocalDate | null;
}

export class PrayerRepository extends MutableRepository<Prayer> {
  constructor(private readonly database: MddDatabase) {
    super(database.prayers);
  }

  async createPrayer(input: NewPrayerInput): Promise<Prayer> {
    const body = input.body.trim();
    if (!body) throw new Error("Prayer body is required.");

    return this.create({
      body,
      status: "ACTIVE",
      personId: input.personId ?? null,
      categoryId: input.categoryId ?? null,
      scheduleId: input.scheduleId ?? null,
      eventDate: input.eventDate ?? null,
      focusUntil: input.focusUntil ?? null,
      sourceReflectionId: input.sourceReflectionId ?? null,
      sourceDevotionDate: input.sourceDevotionDate ?? null,
      lastPrayedAt: null,
      archivedAt: null,
    });
  }

  async transition(id: UUID, status: PrayerStatus): Promise<Prayer> {
    const prayer = await this.require(id);
    assertPrayerTransition(prayer.status, status);
    if (status === "ANSWERED") {
      throw new Error("Use answer() so an answered prayer always has a resolution record.");
    }

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
  }

  async markPrayed(id: UUID, at: Instant = nowInstant()): Promise<Prayer> {
    const prayer = await this.require(id);
    const next: Prayer = { ...prayer, lastPrayedAt: at, ...nextMutableFields(prayer, at) };
    await this.database.prayers.put(next);
    return next;
  }

  async answer(id: UUID, reflectionMd: string | null = null, at: Instant = nowInstant()): Promise<{ prayer: Prayer; resolution: PrayerResolution }> {
    return this.database.transaction("rw", this.database.prayers, this.database.prayerResolutions, async () => {
      const prayer = await this.require(id);
      assertPrayerTransition(prayer.status, "ANSWERED");

      const existingResolution = await this.database.prayerResolutions.where("prayerId").equals(id).first();
      if (existingResolution && !existingResolution.deletedAt) throw new Error(`Prayer already has a resolution: ${id}`);

      const nextPrayer: Prayer = {
        ...prayer,
        status: "ANSWERED",
        updatedAt: at,
        revision: prayer.revision + 1,
      };
      const resolution: PrayerResolution = {
        ...newMutableFields(at),
        prayerId: id,
        answeredAt: at,
        reflectionMd,
      };

      await this.database.prayers.put(nextPrayer);
      if (existingResolution) {
        await this.database.prayerResolutions.put({ ...resolution, id: existingResolution.id, createdAt: existingResolution.createdAt, revision: existingResolution.revision + 1 });
      } else {
        await this.database.prayerResolutions.add(resolution);
      }
      return { prayer: nextPrayer, resolution: existingResolution ? { ...resolution, id: existingResolution.id, createdAt: existingResolution.createdAt, revision: existingResolution.revision + 1 } : resolution };
    });
  }
}
