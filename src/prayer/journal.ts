import type { MddDatabase } from '../data/database';
import { PrayerSessionRepository, PRAYER_DEPTH_TARGETS } from '../data/repositories/prayer-sessions';
import type { Category, LocalDate, Person, Prayer, PrayerSession, PrayerStatus, TimeZoneId } from '../domain/types';
import { PrayerQueueService } from './queue';

export const prayerStatuses: PrayerStatus[] = ['ACTIVE', 'WAITING', 'ANSWERED', 'ARCHIVED'];
export const prayerStatusLabels: Record<PrayerStatus, string> = { ACTIVE: 'Active', WAITING: 'Waiting', ANSWERED: 'Answered', ARCHIVED: 'Archived' };
export interface PrayerLibrary { prayers: Prayer[]; people: Person[]; categories: Category[]; counts: Record<PrayerStatus, number>; }
export interface PrayerFocus { prayer: Prayer | null; session: PrayerSession | null; reason: string; }

/** Presentation reads never initialize categories, reconcile sessions or record activity. */
export async function loadPrayerLibrary(database: MddDatabase): Promise<PrayerLibrary> {
  return database.transaction('r', [database.prayers, database.people, database.categories], async () => {
    const [prayers, people, categories] = await Promise.all([
      database.prayers.filter(p => p.deletedAt === null).toArray(),
      database.people.filter(p => p.deletedAt === null).toArray(),
      database.categories.filter(c => c.deletedAt === null).toArray(),
    ]);
    prayers.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    people.sort((a, b) => a.name.localeCompare(b.name));
    categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const counts = { ACTIVE: 0, WAITING: 0, ANSWERED: 0, ARCHIVED: 0 };
    for (const prayer of prayers) counts[prayer.status]++;
    return { prayers, people, categories, counts };
  });
}

export async function loadPrayerFocus(database: MddDatabase, date: LocalDate, timeZone: TimeZoneId): Promise<PrayerFocus> {
  return database.transaction('r', [database.prayers, database.prayerSchedules, database.prayerSessions, database.prayerSessionItems], async () => {
    const session = await new PrayerSessionRepository(database).getOpenSession();
    if (session?.localDate === date) {
      const pending = await database.prayerSessionItems.where('sessionId').equals(session.id)
        .filter(item => item.deletedAt === null && item.outcome === null).sortBy('position');
      for (const item of pending) {
        const prayer = await database.prayers.get(item.prayerId);
        if (prayer && !prayer.deletedAt && prayer.status === 'ACTIVE') return { prayer, session, reason: 'Continue your saved session.' };
      }
      // Only the session screen reconciles entries; don't promise a new queue yet.
      return { prayer: null, session, reason: 'Your saved session has no remaining active requests. Open it to finish.' };
    }
    const first = (await new PrayerQueueService(database).build(date, PRAYER_DEPTH_TARGETS.quick, new Set(), timeZone))[0];
    const reason = !first ? 'No requests are eligible for an automatic session today.'
      : first.band === 'FOCUS_OR_EVENT' ? 'Set aside for focus or an upcoming date.'
      : first.band === 'FIXED_DUE' ? 'Scheduled for prayer today.'
      : first.band === 'NEVER_PRAYED' ? 'A request you have not prayed in MDD yet.' : 'Returning gently to an earlier request.';
    return { prayer: first?.prayer ?? null, session: null, reason };
  });
}

export function prayerFilters(params: URLSearchParams, library: PrayerLibrary) {
  const requested = params.get('status')?.toUpperCase();
  const status = prayerStatuses.find(value => value === requested) ?? 'ACTIVE';
  const person = library.people.some(item => item.id === params.get('person')) ? params.get('person')! : '';
  const category = library.categories.some(item => item.id === params.get('category')) ? params.get('category')! : '';
  return { status, person, category };
}
export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return [words[0], words.length > 1 ? words.at(-1) : ''].map(word => Array.from(word ?? '')[0] ?? '').join('').toLocaleUpperCase();
}
export function identityTone(id: string): 'sage' | 'clay' {
  return Array.from(id).reduce((sum, char) => sum + char.codePointAt(0)!, 0) % 2 ? 'clay' : 'sage';
}
