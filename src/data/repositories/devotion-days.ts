import { newMutableFields, nowInstant } from "../../domain/identity";
import type { DevotionDay, LocalDate, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";

export class DevotionDayRepository {
  constructor(private readonly database: MddDatabase) {}

  async ensure(localDate: LocalDate, planEnrollmentId: UUID | null = null): Promise<DevotionDay> {
    const existing = await this.database.devotionDays.where("localDate").equals(localDate).first();
    const at = nowInstant();

    if (existing) {
      const next: DevotionDay = {
        ...existing,
        planEnrollmentId: existing.planEnrollmentId ?? planEnrollmentId,
        lastActiveAt: at,
        updatedAt: at,
        revision: existing.revision + 1,
        deletedAt: null,
      };
      await this.database.devotionDays.put(next);
      return next;
    }

    const day: DevotionDay = {
      ...newMutableFields(at),
      localDate,
      planEnrollmentId,
      startedAt: at,
      lastActiveAt: at,
    };
    await this.database.devotionDays.add(day);
    return day;
  }
}
