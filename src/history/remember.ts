import type { MddDatabase } from '../data/database';
import type { LocalDate } from '../domain/types';
import { reflectiveTypes } from './journal';
import { HistoryRepository, type HistoryEntry } from './repository';
import { validJournalDate } from './review';
export async function loadAnniversaries(db: MddDatabase, today: LocalDate, shown: number): Promise<{ entries: HistoryEntry[]; total: number }> {
  if (!validJournalDate(today)) throw new Error('Invalid anniversary date.');
  const events = await db.transaction('r', db.activityEvents, () => db.activityEvents.filter(event => event.localDate < `${today.slice(0,4)}-01-01` && event.localDate.slice(5) === today.slice(5) && reflectiveTypes.has(event.type)).toArray());
  events.sort((a,b) => b.localDate.localeCompare(a.localDate) || b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  // Resolve before counting: removed sources must not produce private suggestions.
  const entries = (await new HistoryRepository(db).resolveEvents(events)).filter(entry => entry.availability === 'available');
  return { entries: entries.slice(0, shown), total: entries.length };
}
