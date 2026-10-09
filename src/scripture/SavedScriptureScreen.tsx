import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { db } from '../data/database';
import { JournalHeading } from '../writing/JournalPrimitives';
import { DevotionalIcon } from '../app/visual/DevotionalIcon';
import { usePrayerPosition, usePrayerRead } from '../prayer/detail-hooks';
import { loadBibleManifest } from './loader';
import type { BibleManifest } from './types';
import { parseSavedQuery, readSavedScripture, SAVED_VIEWS } from './saved-model';
import { savedPassageUrl, withSearchReturn } from '../search/context';
import { prayerReferenceLabel } from '../prayer/references';
import { matchExcerpt } from '../search/text';

const labels = { bookmarks: 'Bookmarks', highlights: 'Highlights', notes: 'Notes', collections: 'Collections' };
export function SavedScriptureScreen() {
  const location = useLocation(), [, setParams] = useSearchParams();
  const query = parseSavedQuery(location.search), url = location.pathname + location.search;
  const read = usePrayerRead('saved-scripture', () => readSavedScripture(db));
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  useEffect(() => { let active = true; void loadBibleManifest().then(value => { if (active) setManifest(value); }).catch(() => {}); return () => { active = false; }; }, []);
  useEffect(() => { if (query.search !== location.search) setParams(new URLSearchParams(query.search), { replace: true }); }, [query.search, location.search, setParams]);
  usePrayerPosition(url, Boolean(read.data), null, '.saved-journal');
  const rows = read.data?.[query.view] ?? [], visible = rows.slice(0, query.shown);
  const change = (view = query.view, shown = 20) => { const next = new URLSearchParams(location.search); next.set('view', view); if (shown === 20) next.delete('shown'); else next.set('shown', String(shown)); setParams(next); };
  return <main className="journal-workspace saved-journal">
    <JournalHeading title="Saved Scripture" subtitle="Words to return to" back={query.returnTo} />
    <p className="archive-intro">Keep the passages that stay with you close at hand.</p>
    <nav className="archive-segments saved-segments" aria-label="Saved Scripture views">{SAVED_VIEWS.map(view => <button key={view} aria-pressed={view === query.view} onClick={() => change(view)}>{labels[view]}</button>)}</nav>
    <div className="journal-actions"><Link to={withSearchReturn('/search?scope=saved', url)}><DevotionalIcon name="search" /> Search saved Scripture</Link>{query.view === 'collections' && <Link to={withSearchReturn('/bible/collections', url)}>Manage collections →</Link>}</div>
    {read.error && <div className="journal-notice" role="alert">{read.error}<button onClick={read.retry}>Retry refresh</button></div>}
    {!read.data && !read.error && <p role="status" className="journal-help">Opening your saved passages…</p>}
    {read.data && <section><div className="archive-section-heading"><h2>{labels[query.view]}</h2><span>{visible.length} of {rows.length}</span></div>
      {!rows.length && <div className="archive-empty mg-empty-state"><DevotionalIcon name={query.view === 'bookmarks' ? 'bookmark' : query.view === 'highlights' ? 'highlight' : 'note'} /><h3>No {labels[query.view].toLowerCase()} yet</h3><p>{query.view === 'collections' ? 'Gather meaningful passages together in a collection.' : 'Select a verse number in the Bible to bookmark, highlight, or write a note.'}</p><Link to={withSearchReturn(query.view === 'collections' ? '/bible/collections' : '/bible', url)}>{query.view === 'collections' ? 'Create a collection' : 'Open the Bible'} →</Link></div>}
      {visible.map(item => {
        const collection = 'name' in item, title = collection ? item.name : prayerReferenceLabel(item, manifest);
        const text = collection ? item.description : 'bodyMd' in item ? item.bodyMd : 'label' in item ? item.label : null;
        return <Link key={item.id} id={'saved-' + item.id} className="archive-row" to={collection ? withSearchReturn('/bible/collections?' + new URLSearchParams({collection: item.id}), url) : savedPassageUrl(item, url)}><span className="archive-symbol"><DevotionalIcon name={collection ? 'plan' : query.view === 'bookmarks' ? 'bookmark' : query.view === 'highlights' ? 'highlight' : 'note'} /></span><span><strong>{title}</strong>{text && <p>{matchExcerpt(text, '', 180)}</p>}{!collection && <small>{item.translationId}</small>}</span><DevotionalIcon name="chevron" /></Link>;
      })}
      {visible.length < rows.length && <button onClick={() => change(query.view, query.shown + 20)}>Show more</button>}
    </section>}
  </main>;
}
