import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DevotionalIcon } from '../app/visual/DevotionalIcon';
import type { LocalDate, ScriptureReference } from '../domain/types';
import { loadBibleBook } from '../scripture/loader';
import { scriptureTextForRange } from '../scripture/plain-text';
import { parseVerseKey } from '../scripture/repository';

/** Reading preview, not a daily-verse model. Always renders the complete BSB verse. */
export function TodayVerse({ reference, today }: { reference: ScriptureReference | undefined; today: LocalDate }) {
  const [verse, setVerse] = useState<{ text: string; label: string; href: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = reference?.startVerseKey;
  useEffect(() => {
    let cancelled = false;
    setVerse(null); setFailed(false);
    if (!key) return;
    const start = parseVerseKey(key);
    void loadBibleBook(start.bookId).then(book => {
      const chapter = book.chapters.find(item => item.chapter === start.chapter);
      if (!chapter) throw new Error('Reading chapter unavailable.');
      if (!cancelled) setVerse({ text: scriptureTextForRange(chapter, start.verse), label: `${book.name} ${start.chapter}:${start.verse}`, href: `/bible/${book.bookId}/${start.chapter}?verse=${start.verse}` });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [key]);
  const [year, month, day] = today.split('-').map(Number);
  const date = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(year!, month! - 1, day!, 12));
  return <section className="today-verse grace-paper" aria-labelledby="today-verse-title">
    <DevotionalIcon name="sun" className="today-verse-sun" />
    <div>
      <div className="today-verse-heading"><h2 id="today-verse-title">From today’s reading</h2><time dateTime={today}>{date}</time></div>
      {verse ? <><blockquote>{verse.text}</blockquote><Link className="today-verse-reference" to={verse.href}>{verse.label} <span>· BSB</span></Link></> : <p className="today-verse-status">{failed ? 'Your Scripture is waiting in the Bible.' : key ? 'Opening today’s Scripture…' : 'Make room for Scripture today.'}{failed ? <> <Link to="/bible">Open Bible</Link></> : null}</p>}
    </div>
  </section>;
}

