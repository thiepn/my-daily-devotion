import type { MddDatabase } from '../data/database';
import type { ActivityEvent, ActivityEventType, LocalDate } from '../domain/types';
import { HistoryRepository, type HistoryEntry } from './repository';

export const historyViews = ['overview', 'readings', 'prayer', 'reflections'] as const;
export type HistoryView = typeof historyViews[number];
export type HistoryPeriod = 'this-year' | 'all' | `${number}`;
export interface HistoryQuery { period: HistoryPeriod; view: HistoryView; shown: number; }
export interface HistoryMetrics { days: number; prayers: number; reflections: number; }
export interface HistoryRow { id: string; localDate: LocalDate; occurredAt: string; eventIds: string[]; entry: HistoryEntry; }
export interface HistoryJournal { metrics: HistoryMetrics; years: string[]; archiveTotal: number; periodTotal: number; total: number; rows: HistoryRow[]; }
export const reflectiveTypes = new Set<ActivityEventType>(['REFLECTION_CREATED', 'PRAYER_ANSWERED', 'ENCOURAGEMENT_RECORDED', 'HIGHLIGHT_CREATED']);
const prayerTypes = new Set<ActivityEventType>(['PRAYER_CREATED', 'PRAYER_PRAYED', 'PRAYER_UPDATED', 'ENCOURAGEMENT_RECORDED', 'PRAYER_ANSWERED']);
export function parseHistoryQuery(params: URLSearchParams, moments = false): HistoryQuery {
  const period = params.get('period') ?? 'this-year', view = params.get('view');
  const minimum = moments ? 20 : 5, shown = Number(params.get('shown') ?? minimum);
  return { period: period === 'all' || period === 'this-year' || /^[1-9]\d{3}$/.test(period) ? period as HistoryPeriod : 'this-year',
    view: historyViews.find(v => v === view) ?? 'overview', shown: Number.isSafeInteger(shown) && shown >= minimum ? shown : minimum };
}
export function safeHistoryReturn(value: string | null, fallback = '/history'): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
export function withHistoryReturn(href: string, from: string): string {
  const [path, search = ''] = href.split('?'); const params = new URLSearchParams(search); params.set('return', from);
  return `${path}?${params}`;
}
export function historyDayUrl(row: HistoryRow, from: string): string {
  return withHistoryReturn(`/history/day/${row.localDate}?entry=${encodeURIComponent(row.eventIds[0]!)}`, from);
}
export function filterHistoryEvents(events: ActivityEvent[], query: HistoryQuery, today: LocalDate): ActivityEvent[] {
  const year = query.period === 'this-year' ? today.slice(0, 4) : query.period;
  return year === 'all' ? events : events.filter(e => e.localDate.startsWith(`${year}-`));
}
function descending(a: ActivityEvent, b: ActivityEvent): number { return b.localDate.localeCompare(a.localDate) || b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id); }
export function groupHistoryEvents(events: ActivityEvent[], view: HistoryView, moments = false): ActivityEvent[][] {
  const filtered = events.filter(e => moments ? reflectiveTypes.has(e.type) : view === 'overview' ? true : view === 'readings' ? e.type === 'READING_COMPLETED' : view === 'reflections' ? e.type === 'REFLECTION_CREATED' : prayerTypes.has(e.type));
  const groups = new Map<string, ActivityEvent[]>();
  for (const event of [...filtered].sort(descending)) {
    const { enrollmentId, assignmentSequence } = event.metadata;
    const key = event.type === 'PRAYER_PRAYED' ? `prayed:${event.localDate}`
      : event.type === 'READING_COMPLETED' && typeof enrollmentId === 'string' && typeof assignmentSequence === 'number' ? `reading:${event.localDate}:${enrollmentId}:${assignmentSequence}` : event.id;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.values()].sort((a, b) => descending(a[0]!, b[0]!));
}
export async function loadHistoryJournal(db: MddDatabase, query: HistoryQuery, today: LocalDate, moments = false): Promise<HistoryJournal> {
  const all = await db.transaction('r', db.activityEvents, () => db.activityEvents.toArray());
  const events = filterHistoryEvents(all, query, today);
  const metrics = { days: new Set(events.map(e => e.localDate)).size,
    prayers: new Set(events.filter(e => e.type === 'PRAYER_CREATED').map(e => e.subjectId)).size,
    reflections: new Set(events.filter(e => e.type === 'REFLECTION_CREATED').map(e => e.subjectId)).size };
  const groups = groupHistoryEvents(events, query.view, moments);
  const visible = groups.slice(0, query.shown);
  // Only reading groups need every source resolved. Prayed summaries expose details on the Day screen.
  const needed = visible.flatMap(group => group[0]!.type === 'READING_COMPLETED' ? group : [group[0]!]);
  const entries = new Map((await new HistoryRepository(db).resolveEvents(needed)).map(entry => [entry.id, entry]));
  const rows = visible.map(group => {
    const event = group[0]!, original = entries.get(event.id)!;
    const entry = event.type === 'PRAYER_PRAYED' ? { ...original, title: `Recorded ${group.length} prayed ${group.length === 1 ? 'action' : 'actions'}`, body: 'A moment set aside for prayer.', fullText: null }
      : group.length > 1 ? { ...original, title: 'Completed readings', body: group.map(e => entries.get(e.id)?.body).filter(Boolean).join(' · ') || null } : original;
    return { id: event.id, localDate: event.localDate, occurredAt: event.occurredAt, eventIds: group.map(e => e.id), entry };
  });
  return { metrics, years: [...new Set([today.slice(0, 4), ...all.map(e => e.localDate.slice(0, 4))])].sort().reverse(), archiveTotal: all.length, periodTotal: events.length, total: groups.length, rows };
}
