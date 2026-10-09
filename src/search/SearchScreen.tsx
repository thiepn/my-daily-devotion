import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { loadBibleManifest } from "../scripture/loader";
import { bibleSearchHref, searchBiblePage, type BibleSearchResult } from "../scripture/search";
import type { BibleManifest } from "../scripture/types";
import { prayerReferenceLabel } from "../prayer/references";
import { searchPersonalPages, type PersonalSearchHit, type SearchPage } from "./personal";
import { parseSearchQuery, SEARCH_LABELS, SEARCH_SCOPES, withSearchReturn, type SearchScope } from "./context";
import { matchingRanges, matchExcerpt } from "./text";
import { JournalHeading } from "../writing/JournalPrimitives";
import { usePrayerPosition, usePrayerRead } from "../prayer/detail-hooks";
import { DevotionalIcon } from "../app/visual/DevotionalIcon";

export function MatchedText({ text, query }: { text: string; query: string }) {
  const parts: ReactNode[] = []; let from = 0;
  for (const [start, end] of matchingRanges(text, query)) { parts.push(text.slice(from, start), <mark key={start}>{text.slice(start, end)}</mark>); from = end; }
  parts.push(text.slice(from)); return <>{parts}</>;
}
export function SearchScreen() {
  const location = useLocation(), [params, setParams] = useSearchParams();
  const query = parseSearchQuery(location.search), url = location.pathname + location.search;
  const [draft, setDraft] = useState(query.q), [attempt, setAttempt] = useState(0);
  const [includeNotes, setIncludeNotes] = useState(query.notes);
  const [corpus, setCorpus] = useState<{key: string; data: SearchPage<BibleSearchResult> | null; error: string}>({key: "", data: null, error: ""});
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  useEffect(() => { if (location.search !== query.search) setParams(new URLSearchParams(query.search), { replace: true }); }, [location.search, query.search, setParams]);
  useEffect(() => setDraft(query.q), [query.q]);
  useEffect(() => setIncludeNotes(query.notes), [query.notes]);
  const corpusEnabled = ['all', 'scripture', 'saved'].includes(query.scope);
  const corpusKey = JSON.stringify([query.q, query.book, query.testament, corpusEnabled]);
  const bible = corpus.key === corpusKey ? corpus.data : null, scriptureError = corpus.key === corpusKey ? corpus.error : "";
  const personal = usePrayerRead(query.q + ':' + query.notes + ':' + JSON.stringify(query.shown) + ':' + (corpusEnabled && bible ? corpusKey : ''), () => searchPersonalPages(db, query.q, { includePersonNotes: query.notes, shown: query.shown, matchingVerseKeys: corpusEnabled ? bible?.items.map(item => item.verseKey) ?? [] : [] }));
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [bible, nextManifest] = await Promise.all([corpusEnabled ? searchBiblePage(query.q, { bookId: query.book, testament: query.testament, limit: Number.MAX_SAFE_INTEGER }) : Promise.resolve({items: [], total: 0}), loadBibleManifest()]);
        if (active) { setCorpus({key: corpusKey, data: bible, error: ""}); setManifest(nextManifest); }
      } catch { if (active) setCorpus({key: corpusKey, data: null, error: "Could not open Scripture search. Your personal results remain available."}); }
    };
    void load(); return () => { active = false; };
  }, [corpusKey, attempt]);
  const visibleBible = bible ? {total: bible.total, items: bible.items.slice(0, query.shown.scripture)} : null;
  usePrayerPosition(url, Boolean(personal.data) && (!corpusEnabled || Boolean(bible) || Boolean(scriptureError)), null, '.search-journal');
  const change = (changes: Record<string, string>, reset = false) => {
    const next = new URLSearchParams(params);
    if (reset) for (const scope of SEARCH_SCOPES) next.delete(`${scope}Shown`);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); change({ q: draft.trim() }, true); };
  const total = query.scope === 'all' ? (bible?.total ?? 0) + Object.values(personal.data ?? {}).reduce((sum, page) => sum + page.total, 0) : query.scope === 'scripture' ? bible?.total ?? 0 : personal.data?.[query.scope].total ?? 0;
  const loading = (!personal.data && !personal.error) || (corpusEnabled && !bible && !scriptureError);
  return <main className="journal-workspace search-journal mg-search-workspace">
    <JournalHeading title="Search" subtitle="Scripture & your journal" back={query.returnTo} />
    <form className="global-search-form archive-search" onSubmit={submit}>
      <label htmlFor="archive-query">Find a passage or something you remember</label>
      <div className="archive-query"><input id="archive-query" aria-label="Search MDD" value={draft} onChange={event => setDraft(event.target.value)} placeholder="A word, a name, or John 3:16…" /><button className="grace-primary" type="submit">Search</button></div>
    </form>
    <nav className="archive-segments" aria-label="Search scope">{SEARCH_SCOPES.map(scope => <button key={scope} type="button" aria-pressed={query.scope === scope} onClick={() => change({scope: scope === 'all' ? '' : scope}, true)}>{SEARCH_LABELS[scope]}</button>)}</nav>
    {(query.scope === 'all' || query.scope === 'scripture') && <details className="archive-options"><summary>Scripture filters</summary><div className="archive-fields"><label>Book<select value={query.book} onChange={event => change({book: event.target.value}, true)}><option value="">All books</option>{manifest?.books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label><label>Testament<select value={query.testament ?? ''} onChange={event => change({testament: event.target.value}, true)}><option value="">Both</option><option value="OT">Old Testament</option><option value="NT">New Testament</option></select></label></div></details>}
    {(query.scope === 'all' || query.scope === 'people') && <label className="archive-checkbox"><input type="checkbox" checked={includeNotes} onChange={event => { setIncludeNotes(event.target.checked); change({notes: event.target.checked ? '1' : ''}, true); }} /> Include private person notes</label>}
    {!query.q ? <section className="archive-empty mg-empty-state"><DevotionalIcon name="search" /><h2>Find what matters</h2><p>Search the bundled Bible, your prayers, reflections, people, and saved passages. Everything stays on this device.</p><Link to={withSearchReturn('/bible/saved', url)}>Browse saved Scripture →</Link></section> : <>
      {personal.error && <div className="journal-notice" role="alert">{personal.error}<button onClick={personal.retry}>Retry personal search</button></div>}
      {corpusEnabled && scriptureError && <div className="journal-notice" role="alert">{scriptureError}<button onClick={() => setAttempt(value => value + 1)}>Retry Scripture search</button></div>}
      {loading && <p className="journal-help" role="status">Searching local data…</p>}
      {!loading && !total && !personal.error && !scriptureError && <p className="archive-empty mg-empty-state">No results for “{query.q}”{query.scope !== 'all' ? ` in ${SEARCH_LABELS[query.scope].toLowerCase()}` : ''}.</p>}
      <div className="search-groups">
        {(query.scope === 'all' || query.scope === 'scripture') && visibleBible && <ResultGroup scope="scripture" page={visibleBible} more={() => change({scriptureShown: String(query.shown.scripture + 20)})}>{visibleBible.items.map(item => <Link id={'search-scripture-' + item.verseKey} className="archive-row search-hit" key={item.verseKey} to={withSearchReturn(bibleSearchHref(item), url)}><span className="archive-symbol"><DevotionalIcon name="bible" /></span><span><strong>{item.bookName} {item.chapter}:{item.verse}</strong><small>Berean Standard Bible</small><p><MatchedText text={matchExcerpt(item.text, query.q)} query={query.q} /></p></span><DevotionalIcon name="chevron" /></Link>)}</ResultGroup>}
        {(['prayers', 'reflections', 'people', 'saved'] as const).map(scope => (query.scope === 'all' || query.scope === scope) && personal.data && <ResultGroup key={scope} scope={scope} page={personal.data[scope]} more={() => change({[`${scope}Shown`]: String(query.shown[scope] + 20)})}>{personal.data[scope].items.map(item => <PersonalHit key={item.kind + item.id} item={item} manifest={manifest} query={query.q} returnTo={url} />)}</ResultGroup>)}
      </div>
    </>}
  </main>;
}
function ResultGroup<T>({scope, page, more, children}: {scope: Exclude<SearchScope, 'all'>; page: SearchPage<T>; more: () => void; children: ReactNode}) {
  if (!page.total) return null;
  return <section className="search-group"><div className="archive-section-heading"><h2>{SEARCH_LABELS[scope]}</h2><span>{page.items.length} of {page.total}</span></div><div>{children}</div>{page.items.length < page.total && <button aria-label={`Show more ${SEARCH_LABELS[scope].toLowerCase()}`} onClick={more}>Show more</button>}</section>;
}
function PersonalHit({item, manifest, query, returnTo}: {item: PersonalSearchHit; manifest: BibleManifest | null; query: string; returnTo: string}) {
  return <Link id={'search-' + item.kind.replace(/\W/g, '-') + '-' + item.id} className="archive-row search-hit" to={withSearchReturn(item.href, returnTo)}><span className="archive-symbol"><DevotionalIcon name={item.kind.startsWith('Prayer') || item.kind === 'Answered prayer' ? 'prayer' : item.kind === 'Person' ? 'profile' : 'note'} /></span><span><small>{item.kind}</small><strong><MatchedText text={item.reference ? prayerReferenceLabel(item.reference, manifest) : item.title} query={query} /></strong>{item.excerpt !== item.title && <p><MatchedText text={item.excerpt} query={query} /></p>}</span><DevotionalIcon name="chevron" /></Link>;
}
