import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { DevotionalIcon } from '../app/visual/DevotionalIcon';
import { MorningGraceArtwork } from '../app/visual/MorningGraceArtwork';
import { useLocalClock } from '../app/useLocalClock';
import { db } from '../data/database';
import { PRAYER_DEPTH_TARGETS } from '../data/repositories/prayer-sessions';
import { loadBibleChapter } from '../scripture/loader';
import { identityTone, loadPrayerFocus, loadPrayerLibrary, personInitials, prayerFilters, prayerStatusLabels, prayerStatuses, type PrayerFocus, type PrayerLibrary } from './journal';

export function PrayerScreen() {
  const { localDate, timeZone } = useLocalClock();
  const [params, setParams] = useSearchParams();
  const [library, setLibrary] = useState<PrayerLibrary | null>(null);
  const [focus, setFocus] = useState<PrayerFocus | null>(null);
  const [error, setError] = useState('');
  const [focusError, setFocusError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [quote, setQuote] = useState('');
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [filtersOpen, setFiltersOpen] = useState(Boolean(params.get('person') || params.get('category')));

  useEffect(() => {
    let cancelled = false;
    setQuoteFailed(false);
    void loadBibleChapter('COL', 4).then(chapter => {
      if (!cancelled) setQuote(chapter.blocks.filter(block => ['paragraph', 'poetry', 'superscription'].includes(block.kind))
        .flatMap(block => block.segments).filter(segment => segment.verseKey === 'COL.4.2').map(segment => segment.text).join('').trim());
    }).catch(() => { if (!cancelled) setQuoteFailed(true); });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    let generation = 0;
    let cancelled = false;
    const refresh = () => {
      const current = ++generation;
      const active = () => !cancelled && current === generation;
      setLoading(true); setError(''); setFocusError('');
      void loadPrayerLibrary(db).then(value => { if (active()) setLibrary(value); })
        .catch(() => { if (active()) setError('Could not open prayers. Your saved requests are unchanged.'); })
        .finally(() => { if (active()) setLoading(false); });
      void loadPrayerFocus(db, localDate, timeZone).then(value => { if (active()) setFocus(value); })
        .catch(() => { if (active()) { setFocus(null); setFocusError('Could not open the prayer preview. Your list is still available.'); } });
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh); document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, [localDate, timeZone, retry]);

  const selected = library ? prayerFilters(params, library) : { status: prayerStatuses.find(s => s === params.get('status')?.toUpperCase()) ?? 'ACTIVE', person: '', category: '' };
  const query = params.toString();
  useEffect(() => { setVisibleCount(5); }, [query]);
  useEffect(() => {
    if (!library) return;
    const next = new URLSearchParams(params);
    const valid = prayerFilters(params, library);
    if (next.has('person') && !valid.person) next.delete('person');
    if (next.has('category') && !valid.category) next.delete('category');
    if (next.has('status') && next.get('status') !== valid.status) next.set('status', valid.status);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [library, params, setParams]);
  const people = useMemo(() => new Map(library?.people.map(person => [person.id, person])), [library]);
  const items = library?.prayers.filter(prayer => prayer.status === selected.status && (!selected.person || prayer.personId === selected.person) && (!selected.category || prayer.categoryId === selected.category)) ?? [];
  const listUrl = `/prayer${query ? `?${query}` : ''}`;
  const returnQuery = new URLSearchParams({ return: listUrl }).toString();
  const addUrl = `/prayer/new?${returnQuery}`;
  const filtered = Boolean(selected.person || selected.category);
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); };
  const clearFilters = () => { const next = new URLSearchParams(params); next.delete('person'); next.delete('category'); setParams(next); };
  const focusPerson = focus?.prayer?.personId ? people.get(focus.prayer.personId) : null;

  return <main className="grace-prayer">
    <header className="prayer-journal-heading">
      <h1>Prayer</h1>
      <Link className="prayer-add" to={addUrl} aria-label="Add prayer"><PlusIcon size={23} weight="light" aria-hidden="true" /></Link>
    </header>
    <div className="prayer-quotation">
      {quote ? <blockquote>“{quote}”</blockquote> : <p>{quoteFailed ? 'A moment to bring your heart to God.' : 'A quiet moment for prayer.'}</p>}
      <Link to={`/bible/COL/4?verse=2&${returnQuery}`}>Colossians 4:2 · BSB</Link>
    </div>
    <nav className="prayer-journal-tabs" aria-label="Prayer status">
      {prayerStatuses.map(status => { const next = new URLSearchParams(params); next.set('status', status); return <Link key={status} aria-current={selected.status === status ? 'page' : undefined} to={`/prayer?${next}`}>
        <span>{prayerStatusLabels[status]}</span><small>{library?.counts[status] ?? '–'}</small>
      </Link>; })}
    </nav>
    <section className="prayer-journal-library" aria-labelledby="prayer-list-heading">
      <div className="prayer-list-heading"><h2 id="prayer-list-heading">Prayer requests</h2><button type="button" aria-expanded={filtersOpen} aria-controls="prayer-filters" onClick={() => setFiltersOpen(value => !value)}>Filters{filtered ? ' · On' : ''}<DevotionalIcon name="down" /></button></div>
      {filtersOpen && <div className="prayer-filters grace-paper" id="prayer-filters">
        <div className="prayer-filter-field"><label htmlFor="prayer-person">Person</label><select id="prayer-person" value={selected.person} onChange={event => setFilter('person', event.target.value)}><option value="">All people</option>{library?.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
        <div className="prayer-filter-field"><label htmlFor="prayer-category">Category</label><select id="prayer-category" value={selected.category} onChange={event => setFilter('category', event.target.value)}><option value="">All categories</option>{library?.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
        <div><button type="button" disabled={!filtered} onClick={clearFilters}>Clear filters</button><Link to="/prayer/people">People</Link><Link to="/prayer/categories">Categories</Link></div>
      </div>}
      {error && <div className="prayer-journal-state" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      {loading && !library ? <p className="prayer-journal-state" role="status">Opening prayers…</p> : library && <>
        {items.length ? <div className="prayer-journal-list">{items.slice(0, visibleCount).map(prayer => {
          const person = prayer.personId ? people.get(prayer.personId) : null;
          return <Link className="prayer-journal-row" key={prayer.id} to={`/prayer/${prayer.id}?${returnQuery}`}>
            <span className={`prayer-identity prayer-identity--${identityTone(person?.id ?? prayer.id)}`} aria-hidden="true">{person ? personInitials(person.name) : <DevotionalIcon name={prayer.status === 'ANSWERED' ? 'check' : 'prayer'} />}</span>
            <span className="prayer-row-copy">{person && <strong>{person.name}</strong>}<span className={`prayer-request-preview${person ? '' : ' is-request-title'}`}>{prayer.body}</span>{prayer.lastPrayedAt && <small>Last prayed <time dateTime={prayer.lastPrayedAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone }).format(new Date(prayer.lastPrayedAt))}</time></small>}</span>
            <DevotionalIcon name="chevron" />
          </Link>;
        })}</div> : <div className="prayer-journal-state prayer-journal-empty"><MorningGraceArtwork variant="botanical" /><h3>{filtered ? 'No matching requests.' : `No ${prayerStatusLabels[selected.status].toLowerCase()} prayers.`}</h3><p>{filtered ? 'Try another person or category, or clear the filters.' : selected.status === 'ACTIVE' ? 'Bring what is on your heart. A few words are enough to begin.' : 'There is nothing here just now.'}</p>{filtered ? <button type="button" onClick={clearFilters}>Clear filters</button> : selected.status === 'ACTIVE' ? <Link to={addUrl}>Add prayer<DevotionalIcon name="arrow" /></Link> : null}</div>}
        <div className="prayer-list-footer"><span role="status">Showing {Math.min(visibleCount, items.length)} of {items.length} requests</span>{items.length > visibleCount && <button type="button" onClick={() => setVisibleCount(value => value + 10)}>Show more<DevotionalIcon name="down" /></button>}</div>
      </>}
    </section>
    <section className="prayer-focus-card grace-paper" aria-labelledby="prayer-focus-heading">
      <div className="prayer-focus-caption"><MorningGraceArtwork variant="botanical" /><h2 id="prayer-focus-heading">A focus prayer</h2></div>
      {focusError ? <div role="status"><p>{focusError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry preview</button></div> : !focus ? <p>Preparing your prayer preview…</p> : <>
        {focus.prayer ? <><h3>{focusPerson?.name ?? 'Bring it to Him'}</h3><p className="prayer-focus-request">{focus.prayer.body}</p></> : <h3>{focus.session ? 'A quiet place to finish.' : 'A moment for prayer.'}</h3>}
        {(focus.prayer || focus.session) && <Link className="prayer-focus-action" to={`/prayer/session?depth=${focus.session?.depth ?? 'quick'}`}>{focus.session ? focus.prayer ? 'Resume prayer' : 'Finish session' : 'Begin prayer'}<DevotionalIcon name="arrow" /></Link>}
        <p className="prayer-focus-reason">{focus.reason}{!focus.prayer && !focus.session ? ' Manual-only requests remain in your list.' : ''}</p>
        {!focus.session && focus.prayer && <details className="prayer-session-length"><summary>Session length<DevotionalIcon name="down" /></summary><div>{Object.entries(PRAYER_DEPTH_TARGETS).map(([depth, target]) => <Link key={depth} to={`/prayer/session?depth=${depth}`}><strong>{depth.charAt(0).toUpperCase() + depth.slice(1)}</strong><span>about {target} requests</span></Link>)}</div><p>Focused and due requests may make a session longer.</p></details>}
      </>}
    </section>
    <nav className="prayer-utility-links" aria-label="Prayer utilities"><Link to={`/search?${returnQuery}`}>Search</Link><Link to={`/data?${returnQuery}`}>Data</Link></nav>
  </main>;
}
