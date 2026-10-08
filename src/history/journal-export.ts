import type { MddDatabase } from '../data/database';
import type { ActivityEventType } from '../domain/types';
import { HistoryRepository, type HistoryEntry } from './repository';
import { parseJournalRange, type JournalDateRange } from './review';
import { loadBibleManifest } from '../scripture/loader';

export const journalSections = ['reflections', 'requests', 'updates', 'answers', 'scripture'] as const;
export type JournalSection = typeof journalSections[number];
export const journalSectionLabels: Record<JournalSection, string> = {
  reflections: 'Reflections', requests: 'Prayer requests', updates: 'Updates & encouragement', answers: 'Answered prayers', scripture: 'Reading & highlight references',
};
const sectionsByType: Partial<Record<ActivityEventType, JournalSection>> = {
  REFLECTION_CREATED: 'reflections', PRAYER_CREATED: 'requests', PRAYER_UPDATED: 'updates', ENCOURAGEMENT_RECORDED: 'updates', PRAYER_ANSWERED: 'answers', READING_COMPLETED: 'scripture', HIGHLIGHT_CREATED: 'scripture',
};
export interface JournalExportEntry extends HistoryEntry { referenceText: string | null; }
export interface SelectedJournal { range: JournalDateRange; sections: JournalSection[]; entries: JournalExportEntry[]; unavailable: number; }
export function parseJournalSections(value: string | null): JournalSection[] {
  return value === null ? [...journalSections] : journalSections.filter(section => value.split(',').includes(section));
}
/** Event dates define selection; timestamps never move a stored devotional date. */
export async function loadSelectedJournal(db: MddDatabase, range: JournalDateRange, sections: readonly JournalSection[]): Promise<SelectedJournal> {
  if (!parseJournalRange(range.from, range.to)) throw new Error('Choose a valid inclusive date range.');
  const chosen = journalSections.filter(section => sections.includes(section));
  const events = await db.transaction('r', db.activityEvents, () => db.activityEvents.where('localDate').between(range.from, range.to, true, true).toArray());
  const selected = events.filter(event => chosen.includes(sectionsByType[event.type]!)).sort((a, b) => a.localDate.localeCompare(b.localDate) || a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  // Repeated historical facts about one saved writing record must not duplicate its current text.
  const seen = new Set<string>();
  const unique = selected.filter(event => { const key = `${event.type}:${event.subjectId}:${event.type === 'PRAYER_ANSWERED' ? event.metadata.resolutionId ?? event.id : ''}`; if (event.type === 'READING_COMPLETED') return true; if (seen.has(key)) return false; seen.add(key); return true; });
  const [resolved, manifest] = await Promise.all([new HistoryRepository(db).resolveEvents(unique), loadBibleManifest().catch(() => null)]);
  const entries = resolved.filter(entry => entry.availability === 'available').map(entry => {
    const reference = entry.reference;
    let referenceText = entry.kind === 'scripture' ? entry.body : null;
    if (reference) {
      const [book, chapter, verse] = reference.startVerseKey.split('.'), [endBook, endChapter, endVerse] = reference.endVerseKey.split('.');
      const name = (id: string | undefined) => manifest?.books.find(item => item.id === id)?.name ?? id;
      referenceText = `${name(book)} ${chapter}:${verse}${reference.startVerseKey === reference.endVerseKey ? '' : book !== endBook ? ` – ${name(endBook)} ${endChapter}:${endVerse}` : chapter !== endChapter ? `–${endChapter}:${endVerse}` : `–${endVerse}`} · ${reference.translationId}`;
    }
    return { ...entry, referenceText };
  });
  return { range, sections: chosen, entries, unavailable: resolved.filter(entry => entry.availability !== 'available').length };
}
export function journalReference(entry: JournalExportEntry): string | null { return entry.referenceText; }
// Literal fenced writing prevents exported user HTML/images from being executed
// by a Markdown viewer while retaining every character for portable reading.
function literalWriting(text: string): string {
  let length = 3;
  for (const match of text.matchAll(/`+/g)) length = Math.max(length, match[0].length + 1);
  const fence = '`'.repeat(length);
  return `${fence}text\n${text}\n${fence}`;
}
export function selectedJournalMarkdown(journal: SelectedJournal): string {
  const introduction = `# My Daily Devotion\n\n${journal.range.from} through ${journal.range.to} (inclusive)\n\nSelected: ${journal.sections.map(section => journalSectionLabels[section]).join(', ') || 'None'}\n\nCurrent saved writing, selected by recorded devotional date. This unencrypted reading export is not a portable backup.\n`;
  return introduction + journal.entries.map(entry => `\n## ${entry.localDate} — ${entry.title}\n\n${journalReference(entry) ? `${journalReference(entry)}\n\n` : ''}${entry.fullText ? literalWriting(entry.fullText) : entry.kind === 'scripture' && entry.body ? entry.body : 'No saved text.'}\n`).join('');
}
