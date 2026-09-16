import { newMutableFields, nextMutableFields } from "../../domain/identity";
import type { LocalDate, Reflection, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";

export class ReflectionRepository {
  constructor(private readonly database: MddDatabase) {}

  async upsertDaily(localDate: LocalDate, devotionDayId: UUID, bodyMd: string): Promise<Reflection> {
    const existing = await this.database.reflections.where("localDate").equals(localDate).first();

    if (existing) {
      const next: Reflection = {
        ...existing,
        bodyMd,
        devotionDayId,
        deletedAt: null,
        ...nextMutableFields(existing),
      };
      await this.database.reflections.put(next);
      return next;
    }

    const reflection: Reflection = {
      ...newMutableFields(),
      localDate,
      devotionDayId,
      bodyMd,
    };
    await this.database.reflections.add(reflection);
    return reflection;
  }
}
