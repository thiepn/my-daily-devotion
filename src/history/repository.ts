import { loadMcheynePlan } from '../mcheyne/loader';
import { buildPlanReadingUrl } from '../mcheyne/context';
import type { MddDatabase } from '../data/database';
import type { ActivityEvent, ActivityEventType, LocalDate, ScriptureReference } from '../domain/types';

export type HistoryEntryKind = 'scripture' | 'reflection' | 'prayer' | 'encouragement' | 'answer' | 'highlight';
export interface HistoryEntry {
  id: string; eventType: ActivityEventType; localDate: LocalDate; occurredAt: string;
  kind: HistoryEntryKind; title: string; body: string | null; href: string | null;
  reference: ScriptureReference | null; metadata: Record<string, unknown>;
  fullText?: string | null; availability?: 'available' | 'removed' | 'unavailable';
}
export interface HistoryDaySummary { localDate: LocalDate; counts: Partial<Record<ActivityEventType, number>>; total: number; }
const LEGACY_MOMENTS = new Set<ActivityEventType>(['HIGHLIGHT_CREATED', 'REFLECTION_CREATED', 'PRAYER_CREATED', 'PRAYER_UPDATED', 'ENCOURAGEMENT_RECORDED', 'PRAYER_ANSWERED']);
export function historyExcerpt(value: string | null | undefined, limit = 220): string | null {
  if (!value) return null;
  const clean = value.replace(/[#>*_`\[\]()~-]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}
export function summarizeDays(events: ActivityEvent[]): HistoryDaySummary[] {
  const days = new Map<LocalDate, HistoryDaySummary>();
  for (const event of events) {
    const day = days.get(event.localDate) ?? { localDate: event.localDate, counts: {}, total: 0 };
    day.total++; day.counts[event.type] = (day.counts[event.type] ?? 0) + 1; days.set(event.localDate, day);
  }
  return [...days.values()].sort((a, b) => b.localDate.localeCompare(a.localDate));
}
export class HistoryRepository {
  constructor(private readonly database: MddDatabase) {}
  async listDaySummaries(month?: string): Promise<HistoryDaySummary[]> {
    return summarizeDays(await (month ? this.database.activityEvents.where('localDate').between(`${month}-01`, `${month}-31`, true, true).toArray() : this.database.activityEvents.toArray()));
  }
  async listDay(localDate: LocalDate): Promise<HistoryEntry[]> {
    const events = await this.database.activityEvents.where('localDate').equals(localDate).toArray();
    return this.resolveEvents(events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id)));
  }
  /** Compatibility API; the journal has its own explicitly filtered, uncapped feed. */
  async listMoments(limit = 200): Promise<HistoryEntry[]> {
    const events = await this.database.activityEvents.orderBy('occurredAt').reverse().filter(e => LEGACY_MOMENTS.has(e.type)).limit(limit).toArray();
    return this.resolveEvents(events);
  }
  /** Snapshot only referenced source records. Optional static assets resolve after the transaction. */
  async resolveEvents(events: ActivityEvent[]): Promise<HistoryEntry[]> {
    const db = this.database;
    const ids = (types: ActivityEventType[]) => [...new Set(events.filter(e => types.includes(e.type)).map(e => e.subjectId))];
    const snapshot = await db.transaction('r', [db.reflections, db.highlights, db.prayers, db.prayerUpdates, db.prayerResolutions], async () => {
      const [reflections, highlights, updates] = await Promise.all([
        db.reflections.bulkGet(ids(['REFLECTION_CREATED'])), db.highlights.bulkGet(ids(['HIGHLIGHT_CREATED'])),
        db.prayerUpdates.bulkGet(ids(['PRAYER_UPDATED', 'ENCOURAGEMENT_RECORDED'])),
      ]);
      const prayerIds = [...new Set([...ids(['PRAYER_CREATED', 'PRAYER_PRAYED', 'PRAYER_ANSWERED']), ...updates.flatMap(u => u ? [u.prayerId] : [])])];
      const [prayers, resolutions] = await Promise.all([db.prayers.bulkGet(prayerIds), db.prayerResolutions.where('prayerId').anyOf(ids(['PRAYER_ANSWERED'])).toArray()]);
      return { reflections, highlights, updates, prayers, resolutions };
    });
    const byId = <T extends { id: string }>(items: (T | undefined)[]) => new Map(items.filter((i): i is T => Boolean(i)).map(i => [i.id, i]));
    const reflections = byId(snapshot.reflections), highlights = byId(snapshot.highlights), prayers = byId(snapshot.prayers), updates = byId(snapshot.updates), resolutions = byId(snapshot.resolutions);
    const plan = events.some(e => e.type === 'READING_COMPLETED') ? await loadMcheynePlan().catch(() => null) : null;
    return events.map(event => {
      const base: HistoryEntry = { id: event.id, eventType: event.type, localDate: event.localDate, occurredAt: event.occurredAt, kind: 'prayer', title: 'Recorded prayer', body: null, fullText: null, href: null, reference: null, metadata: event.metadata, availability: 'unavailable' };
      if (event.type === 'READING_COMPLETED') {
        const sequence = Number(event.metadata.assignmentSequence), index = Number(event.metadata.readingIndex);
        const reading = Number.isInteger(sequence) && sequence >= 1 && sequence <= 365 && typeof event.metadata.readingIndex === 'number' && index >= 0 && index <= 3 ? plan?.assignments[sequence - 1]?.readings[index] : null;
        const enrollment = typeof event.metadata.enrollmentId === 'string' ? event.metadata.enrollmentId : null;
        return { ...base, kind: 'scripture' as const, title: 'Completed reading', body: reading?.displayReference ?? null,
          href: reading && enrollment ? buildPlanReadingUrl(reading, enrollment, sequence, index, 'plan') : null,
          reference: reading?.references[0] ?? null, availability: reading ? 'available' as const : 'unavailable' as const };
      }
      if (event.type === 'HIGHLIGHT_CREATED') {
        const item = highlights.get(event.subjectId), valid = item && !item.deletedAt;
        const reference = valid ? { translationId: item.translationId, startVerseKey: item.startVerseKey, endVerseKey: item.endVerseKey } : null;
        return { ...base, kind: 'highlight' as const, title: item?.deletedAt ? 'Highlight removed' : 'Scripture highlighted', reference,
          href: reference ? `/bible/${reference.startVerseKey.split('.')[0]}/${reference.startVerseKey.split('.')[1]}?verse=${reference.startVerseKey.split('.')[2]}` : null,
          availability: valid ? 'available' as const : item?.deletedAt ? 'removed' as const : 'unavailable' as const };
      }
      if (event.type === 'REFLECTION_CREATED') {
        const item = reflections.get(event.subjectId), valid = item && !item.deletedAt;
        return { ...base, kind: 'reflection' as const, title: valid ? 'Reflection written' : 'Reflection removed', body: valid ? historyExcerpt(item.bodyMd) : null, fullText: valid ? item.bodyMd : null,
          href: valid ? `/today/reflection/${event.localDate}` : null, availability: valid ? 'available' as const : item?.deletedAt ? 'removed' as const : 'unavailable' as const };
      }
      if (event.type === 'PRAYER_UPDATED' || event.type === 'ENCOURAGEMENT_RECORDED') {
        const update = updates.get(event.subjectId), prayer = update ? prayers.get(update.prayerId) : null;
        const valid = update && !update.deletedAt && prayer && !prayer.deletedAt;
        return { ...base, kind: event.type === 'ENCOURAGEMENT_RECORDED' ? 'encouragement' as const : 'prayer' as const,
          title: event.type === 'ENCOURAGEMENT_RECORDED' ? 'Encouragement recorded' : 'Prayer updated', body: valid ? historyExcerpt(update.body) : null, fullText: valid ? update.body : null,
          href: valid ? `/prayer/${prayer.id}` : null, availability: valid ? 'available' as const : update?.deletedAt || prayer?.deletedAt ? 'removed' as const : 'unavailable' as const };
      }
      const prayer = prayers.get(event.subjectId), valid = prayer && !prayer.deletedAt;
      if (event.type === 'PRAYER_ANSWERED') {
        const resolutionId = event.metadata.resolutionId;
        const resolution = typeof resolutionId === 'string' ? resolutions.get(resolutionId) : snapshot.resolutions.find(r => r.prayerId === event.subjectId);
        const available = valid && resolution && !resolution.deletedAt && resolution.prayerId === event.subjectId;
        return { ...base, kind: 'answer' as const, title: valid ? 'Answered prayer' : 'Prayer removed', body: available ? historyExcerpt(resolution.reflectionMd) : null,
          fullText: available ? resolution.reflectionMd : null, href: available ? `/prayer/${event.subjectId}` : null,
          availability: available ? 'available' as const : prayer?.deletedAt || resolution?.deletedAt ? 'removed' as const : 'unavailable' as const };
      }
      return { ...base, title: valid ? event.type === 'PRAYER_CREATED' ? 'Added a prayer request' : 'Prayer prayed' : 'Prayer removed', body: valid ? historyExcerpt(prayer.body) : null,
        fullText: valid ? prayer.body : null, href: valid ? `/prayer/${prayer.id}` : null, availability: valid ? 'available' as const : prayer?.deletedAt ? 'removed' as const : 'unavailable' as const };
    });
  }
}
