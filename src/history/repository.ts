import type { MddDatabase } from "../data/database";
import type { ActivityEvent, ActivityEventType, LocalDate, ScriptureReference } from "../domain/types";

export type HistoryEntryKind = "scripture" | "reflection" | "prayer" | "encouragement" | "answer" | "highlight";

export interface HistoryEntry {
  id: string;
  eventType: ActivityEventType;
  localDate: LocalDate;
  occurredAt: string;
  kind: HistoryEntryKind;
  title: string;
  body: string | null;
  href: string | null;
  reference: ScriptureReference | null;
  metadata: Record<string, unknown>;
}

export interface HistoryDaySummary {
  localDate: LocalDate;
  counts: Partial<Record<ActivityEventType, number>>;
  total: number;
}

const MOMENT_TYPES = new Set<ActivityEventType>([
  "HIGHLIGHT_CREATED",
  "REFLECTION_CREATED",
  "PRAYER_CREATED",
  "PRAYER_UPDATED",
  "ENCOURAGEMENT_RECORDED",
  "PRAYER_ANSWERED",
]);

function excerpt(value: string | null | undefined, limit = 220): string | null {
  if (!value) return null;
  const clean = value.replace(/[#>*_`\[\]()~-]/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}

function metadataNumber(event: ActivityEvent, key: string): number | null {
  const value = event.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export class HistoryRepository {
  constructor(private readonly database: MddDatabase) {}

  async listDaySummaries(): Promise<HistoryDaySummary[]> {
    const events = await this.database.activityEvents.toArray();
    const map = new Map<LocalDate, HistoryDaySummary>();
    for (const event of events) {
      const current = map.get(event.localDate) ?? { localDate: event.localDate, counts: {}, total: 0 };
      current.total += 1;
      current.counts[event.type] = (current.counts[event.type] ?? 0) + 1;
      map.set(event.localDate, current);
    }
    return [...map.values()].sort((a, b) => b.localDate.localeCompare(a.localDate));
  }

  async listDay(localDate: LocalDate): Promise<HistoryEntry[]> {
    const events = await this.database.activityEvents.where("localDate").equals(localDate).toArray();
    const entries = await Promise.all(events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map((event) => this.resolve(event)));
    return entries.filter((entry): entry is HistoryEntry => entry !== null);
  }

  async listMoments(limit = 200): Promise<HistoryEntry[]> {
    const events = (await this.database.activityEvents.toArray())
      .filter((event) => MOMENT_TYPES.has(event.type))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);
    const entries = await Promise.all(events.map((event) => this.resolve(event)));
    return entries.filter((entry): entry is HistoryEntry => entry !== null);
  }

  private async resolve(event: ActivityEvent): Promise<HistoryEntry | null> {
    if (event.type === "READING_COMPLETED") {
      const sequence = metadataNumber(event, "assignmentSequence");
      const readingIndex = metadataNumber(event, "readingIndex");
      return {
        id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt, kind: "scripture",
        title: sequence ? `M’Cheyne day ${sequence} reading completed` : "Scripture reading completed",
        body: readingIndex === null ? null : `Reading ${readingIndex + 1} of 4`, href: "/today/plan", reference: null, metadata: event.metadata,
      };
    }

    if (event.type === "HIGHLIGHT_CREATED") {
      const item = await this.database.highlights.get(event.subjectId);
      const reference = item ? { translationId: item.translationId, startVerseKey: item.startVerseKey, endVerseKey: item.endVerseKey } : null;
      return { id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt, kind: "highlight", title: "Scripture highlighted", body: null, href: reference ? `/bible/${reference.startVerseKey.split(".")[0]}/${reference.startVerseKey.split(".")[1]}` : null, reference, metadata: event.metadata };
    }

    if (event.type === "REFLECTION_CREATED") {
      const reflection = await this.database.reflections.get(event.subjectId);
      return { id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt, kind: "reflection", title: "Reflection written", body: excerpt(reflection?.bodyMd), href: `/today/reflection/${event.localDate}`, reference: null, metadata: event.metadata };
    }

    if (event.type === "PRAYER_UPDATED" || event.type === "ENCOURAGEMENT_RECORDED") {
      const update = await this.database.prayerUpdates.get(event.subjectId);
      const prayerId = update?.prayerId ?? (typeof event.metadata.prayerId === "string" ? event.metadata.prayerId : null);
      return {
        id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt,
        kind: event.type === "ENCOURAGEMENT_RECORDED" ? "encouragement" : "prayer",
        title: event.type === "ENCOURAGEMENT_RECORDED" ? "Prayer encouragement" : "Prayer updated",
        body: excerpt(update?.body), href: prayerId ? `/prayer/${prayerId}` : null, reference: null, metadata: event.metadata,
      };
    }

    if (event.type === "PRAYER_ANSWERED") {
      const prayer = await this.database.prayers.get(event.subjectId);
      const resolution = await this.database.prayerResolutions.where("prayerId").equals(event.subjectId).first();
      return { id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt, kind: "answer", title: "Answered prayer", body: excerpt(resolution?.reflectionMd ?? prayer?.body), href: `/prayer/${event.subjectId}`, reference: null, metadata: event.metadata };
    }

    if (event.type === "PRAYER_CREATED" || event.type === "PRAYER_PRAYED") {
      const prayer = await this.database.prayers.get(event.subjectId);
      return {
        id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt, kind: "prayer",
        title: event.type === "PRAYER_CREATED" ? "Prayer captured" : "Prayer prayed",
        body: excerpt(prayer?.body), href: prayer ? `/prayer/${prayer.id}` : null, reference: null, metadata: event.metadata,
      };
    }

    return null;
  }
}
