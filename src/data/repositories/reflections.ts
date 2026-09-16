import { ActivityLog } from "../activity";
import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import type { LocalDate, Reflection, ScriptureLink, ScriptureReference, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";
import { DevotionDayRepository } from "./devotion-days";

function sameReference(a: ScriptureReference, b: ScriptureReference): boolean {
  return a.translationId === b.translationId && a.startVerseKey === b.startVerseKey && a.endVerseKey === b.endVerseKey;
}

export class ReflectionRepository {
  private readonly days: DevotionDayRepository;
  private readonly activity: ActivityLog;

  constructor(private readonly database: MddDatabase) {
    this.days = new DevotionDayRepository(database);
    this.activity = new ActivityLog(database);
  }

  async getDaily(localDate: LocalDate): Promise<Reflection | undefined> {
    const items = await this.database.reflections.where("localDate").equals(localDate).toArray();
    return items.filter((item) => item.deletedAt === null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async getById(id: UUID): Promise<Reflection | undefined> {
    const item = await this.database.reflections.get(id);
    return item && item.deletedAt === null ? item : undefined;
  }

  async saveDaily(localDate: LocalDate, bodyMd: string): Promise<{ reflection: Reflection; created: boolean }> {
    const normalized = bodyMd.replace(/\r\n/g, "\n").trimEnd();
    if (!normalized.trim()) throw new Error("Reflection text is required before saving.");

    return this.database.transaction(
      "rw",
      this.database.devotionDays,
      this.database.reflections,
      this.database.activityEvents,
      async () => {
        const day = await this.days.ensure(localDate);
        const all = await this.database.reflections.where("localDate").equals(localDate).toArray();
        const existing = all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

        if (existing) {
          const next: Reflection = {
            ...existing,
            bodyMd: normalized,
            devotionDayId: day.id,
            deletedAt: null,
            ...nextMutableFields(existing),
          };
          await this.database.reflections.put(next);
          for (const duplicate of all.slice(1).filter((item) => item.deletedAt === null)) {
            await this.database.reflections.put({ ...duplicate, deletedAt: nowInstant(), ...nextMutableFields(duplicate) });
          }
          return { reflection: next, created: false };
        }

        const reflection: Reflection = {
          ...newMutableFields(),
          localDate,
          bodyMd: normalized,
          devotionDayId: day.id,
        };
        await this.database.reflections.add(reflection);
        await this.activity.record({
          type: "REFLECTION_CREATED",
          localDate,
          subjectType: "reflection",
          subjectId: reflection.id,
          metadata: {},
        });
        return { reflection, created: true };
      },
    );
  }

  async listScriptureLinks(reflectionId: UUID): Promise<ScriptureLink[]> {
    return this.database.scriptureLinks
      .where("[ownerType+ownerId]")
      .equals(["reflection", reflectionId])
      .filter((item) => item.deletedAt === null)
      .sortBy("createdAt");
  }

  async attachScripture(reflectionId: UUID, reference: ScriptureReference): Promise<ScriptureLink> {
    const reflection = await this.getById(reflectionId);
    if (!reflection) throw new Error("Reflection not found.");
    const items = await this.database.scriptureLinks
      .where("[ownerType+ownerId]")
      .equals(["reflection", reflectionId])
      .toArray();
    const existing = items.find((item) => sameReference(item, reference));
    if (existing) {
      if (existing.deletedAt === null) return existing;
      const restored: ScriptureLink = { ...existing, ...nextMutableFields(existing), deletedAt: null };
      await this.database.scriptureLinks.put(restored);
      return restored;
    }

    const link: ScriptureLink = {
      ...newMutableFields(),
      ownerType: "reflection",
      ownerId: reflectionId,
      ...reference,
    };
    await this.database.scriptureLinks.add(link);
    return link;
  }

  async detachScripture(linkId: UUID): Promise<void> {
    const link = await this.database.scriptureLinks.get(linkId);
    if (!link || link.deletedAt !== null) return;
    await this.database.scriptureLinks.put({ ...link, ...nextMutableFields(link), deletedAt: nowInstant() });
  }

  async removeDaily(localDate: LocalDate): Promise<void> {
    const reflection = await this.getDaily(localDate);
    if (!reflection) return;
    await this.database.transaction("rw", this.database.reflections, this.database.scriptureLinks, async () => {
      await this.database.reflections.put({ ...reflection, ...nextMutableFields(reflection), deletedAt: nowInstant() });
      const links = await this.listScriptureLinks(reflection.id);
      for (const link of links) {
        await this.database.scriptureLinks.put({ ...link, ...nextMutableFields(link), deletedAt: nowInstant() });
      }
    });
  }
}
