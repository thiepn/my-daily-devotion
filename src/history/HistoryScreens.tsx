import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { DevotionalIcon, type DevotionalIconName } from '../app/visual/DevotionalIcon';
import { MorningGraceArtwork } from '../app/visual/MorningGraceArtwork';
import { useLocalClock } from '../app/useLocalClock';
import { db } from '../data/database';
import { assertLocalDate } from '../domain/time';
import type { LocalDate, ScriptureReference } from '../domain/types';
import { loadBibleChapter } from '../scripture/loader';
import type { BibleManifest } from '../scripture/types';
import { HistoryRepository, type HistoryDaySummary, type HistoryEntry } from './repository';
import { historyDayUrl, historyViews, loadHistoryJournal, parseHistoryQuery, safeHistoryReturn, withHistoryReturn, type HistoryQuery, type HistoryRow } from './journal';
import { useHistoryLoad, useHistoryPosition, useHistoryManifest, rememberHistoryPosition } from './hooks';

const repository = new HistoryRepository(db);
const viewNames = { overview: 'Overview', readings: 'Readings', prayer: 'Prayer', reflections: 'Reflections' };
const icons: Record<HistoryEntry['kind'], DevotionalIconName> = { scripture: 'bible', reflection: 'note', prayer: 'prayer', encouragement: 'sun', answer: 'check', highlight: 'highlight' };
function validDate(value: string): value is LocalDate { try { assertLocalDate(value); return true; } catch { return false; } }
function validMonth(value: string | null): value is string { return Boolean(value && /^\d{4}-\d{2}$/.test(value) && validDate(`${value}-01`)); }
function dateObject(date: string) { return new Date(`${date}T12:00:00`); }
function dateLabel(date: LocalDate, today?: LocalDate) {
  if (!today) return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(dateObject(date));
  if (date === today) return 'Today';
  const previous = dateObject(today); previous.setDate(previous.getDate() - 1);
  if (date === `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' as const } : {}) }).format(dateObject(date));
}
function referenceLabel(reference: ScriptureReference, manifest: BibleManifest | null) {
  const [book, chapter, verse] = reference.startVerseKey.split('.'), [endBook, endChapter, endVerse] = reference.endVerseKey.split('.');
  return `${manifest?.books.find(b => b.id === book)?.name ?? book} ${chapter}:${verse}${reference.startVerseKey === reference.endVerseKey ? '' : book === endBook && chapter === endChapter ? `–${endVerse}` : `–${endChapter}:${endVerse}`}`;
}
function Heading({ title, url, children }: { title: string; url: string; children?: ReactNode }) { return <header className="history-journal-heading"><div>{children}<h1>{title}</h1></div><Link className="history-search" aria-label="Search history and Scripture" to={withHistoryReturn('/search', url)}><DevotionalIcon name="search" /></Link></header>; }
function State({ children, error, retry }: { children?: ReactNode; error?: string; retry?: () => void }) { return <div className="history-journal-state" role={error ? 'alert' : 'status'}><p>{error || children}</p>{error && <button type="button" onClick={retry}>Try again</button>}</div>; }
function Period({ query, years, onChange, today }: { query: HistoryQuery; years: string[]; onChange: (value: string) => void; today: LocalDate }) {
  const options = [...new Set([...years, ...(query.period !== 'all' && query.period !== 'this-year' ? [query.period] : [])])].sort().reverse();
  return <label className="history-period"><span className="sr-only">History period</span><select aria-label="History period" value={query.period} onChange={e => onChange(e.target.value)}><option value="this-year">This year · {today.slice(0, 4)}</option>{options.map(year => <option value={year} key={year}>{year}</option>)}<option value="all">All time</option></select></label>;
}
function Feed({ rows, today, url, manifest }: { rows: HistoryRow[]; today: LocalDate; url: string; manifest: BibleManifest | null }) {
  return <div className="history-journal-list">{rows.map(row => <Link id={`history-row-${row.id}`} key={row.id} className="history-journal-row" to={historyDayUrl(row, url)}><span className={`history-symbol kind-${row.entry.kind}`}><DevotionalIcon name={icons[row.entry.kind]} /></span><span className="history-row-copy"><strong>{row.entry.title}</strong><span>{row.entry.body || (row.entry.reference ? referenceLabel(row.entry.reference, manifest) : row.entry.availability === 'removed' ? 'This record was removed.' : row.entry.availability === 'unavailable' ? 'Original details are unavailable.' : '')}</span></span><time dateTime={row.localDate}>{dateLabel(row.localDate, today)}</time></Link>)}</div>;
}
function ReflectionBand({ url }: { url: string }) {
  const [quote, setQuote] = useState('');
  useEffect(() => { let active = true; void loadBibleChapter('LAM', 3).then(chapter => { if (active) setQuote(chapter.blocks.flatMap(b => b.segments).filter(s => s.verseKey === 'LAM.3.22' || s.verseKey === 'LAM.3.23').map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()); }).catch(() => {}); return () => { active = false; }; }, []);
  return <aside className="history-reflection-band" aria-label="Scripture for reflection"><MorningGraceArtwork variant="reflection" />{quote ? <blockquote>“{quote}”</blockquote> : <p>A quiet place to remember His faithfulness.</p>}<Link to={withHistoryReturn('/bible/LAM/3?verse=22', url)}>Lamentations 3:22–23 · BSB</Link></aside>;
}
function useJournal(moments = false) {
  const clock = useLocalClock(), [params, setParams] = useSearchParams(), location = useLocation();
  const query = parseHistoryQuery(params, moments), url = location.pathname + location.search;
  const result = useHistoryLoad(`${url}|${clock.localDate}`, () => loadHistoryJournal(db, query, clock.localDate, moments));
  useEffect(() => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(query)) if (next.has(key) && next.get(key) !== String(value)) next.set(key, String(value));
    if (next.has('shown') && result.data && query.shown > Math.max(moments ? 20 : 5, result.data.total)) next.set('shown', String(Math.max(moments ? 20 : 5, result.data.total)));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [params, setParams, query.period, query.view, query.shown, result.data, moments]);
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); next.set(key, value); if (key !== 'shown') next.delete('shown'); else rememberHistoryPosition(`${location.pathname}?${next}`); setParams(next); };
  useHistoryPosition(url, Boolean(result.data));
  return { ...result, ...clock, query, url, change, params };
}
export function HistoryScreen() {
  const { data, error, retry, localDate, query, url, change, params } = useJournal(), manifest = useHistoryManifest();
  return <main className="grace-history history-screen"><Heading title="History" url={url} />
    <nav className="history-journal-tabs" aria-label="History views">{historyViews.map(view => { const next = new URLSearchParams(params); next.set('view', view); next.delete('shown'); return <Link key={view} aria-current={query.view === view ? 'page' : undefined} to={`/history?${next}`}>{viewNames[view]}</Link>; })}</nav>
    <section className="history-overview-card grace-paper" aria-labelledby="history-overview-heading"><div className="history-card-heading"><MorningGraceArtwork variant="botanical" /><div><h2 id="history-overview-heading">{query.period === 'all' ? 'A Record of Grace' : 'A Year of Grace'}</h2><Period query={query} years={data?.years ?? []} today={localDate} onChange={value => change('period', value)} /></div></div><div className="history-journal-stats" aria-busy={!data && !error}><div><strong>{data?.metrics.days ?? '—'}</strong><span>Days recorded</span></div><div><strong>{data?.metrics.prayers ?? '—'}</strong><span>Prayers added</span></div><div><strong>{data?.metrics.reflections ?? '—'}</strong><span>Reflections written</span></div></div></section>
    {error && <State error={error} retry={retry} />}<section aria-labelledby="history-activity-heading"><div className="history-activity-heading"><h2 id="history-activity-heading">{query.view === 'overview' ? 'Recent activity' : viewNames[query.view]}</h2><div><Link to={withHistoryReturn(`/history/calendar?period=${query.period}`, url)}>Browse dates</Link><Link to={withHistoryReturn(`/history/moments?period=${query.period}`, url)}>Moments</Link></div></div>
      {!data && !error ? <State>Opening your history…</State> : data && <>{data.rows.length ? <Feed rows={data.rows} today={localDate} url={url} manifest={manifest} /> : <div className="history-journal-empty"><MorningGraceArtwork variant="botanical" /><h3>{!data.archiveTotal ? 'Your story will gather here.' : !data.periodTotal ? 'A quiet chapter.' : 'No entries in this view.'}</h3><p>{!data.archiveTotal ? 'Read, reflect, and pray. Your saved moments will be here to revisit.' : !data.periodTotal ? 'No activity is recorded for this period. You can choose another year or All time.' : 'Try Overview to see the other moments recorded in this period.'}</p>{!data.archiveTotal && <Link to="/today">Open Today<DevotionalIcon name="arrow" /></Link>}</div>}<div className="history-list-footer"><span role="status">Showing {data.rows.length} of {data.total} entries</span>{data.total > data.rows.length && <button id="history-show-more" type="button" onClick={() => change('shown', String(query.shown + 10))}>Show more<DevotionalIcon name="down" /></button>}</div></>}
    </section><ReflectionBand url={url} /><details className="history-about"><summary>About these totals</summary><p>Days recorded counts dates with saved activity. Prayers added and Reflections written count distinct records first added in this period. Removed records can still contribute historical facts. Excerpts show your current saved writing. These totals are not a streak or a measure of faith.</p></details><Link className="history-data-link" to={withHistoryReturn('/data', url)}>Data and privacy</Link></main>;
}
export function HistoryMomentsScreen() {
  const { data, error, retry, query, localDate, url, change, params } = useJournal(true), manifest = useHistoryManifest();
  return <main className="grace-history history-moments-screen"><Heading title="Moments" url={url}><Link className="history-back" to={safeHistoryReturn(params.get('return'))}><DevotionalIcon name="back" />History</Link></Heading><p className="history-intro">Reflections, answers, encouragement, and Scripture to return to.</p><Period query={query} years={data?.years ?? []} today={localDate} onChange={value => change('period', value)} />{error && <State error={error} retry={retry} />}{!data && !error ? <State>Opening moments…</State> : data && <>{data.rows.length ? <Feed rows={data.rows} today={localDate} url={url} manifest={manifest} /> : <State>Reflections, answered prayers, encouragement, and highlights from this period will appear here.</State>}<div className="history-list-footer"><span role="status">Showing {data.rows.length} of {data.total} moments</span>{data.total > data.rows.length && <button id="history-show-more" type="button" onClick={() => change('shown', String(query.shown + 20))}>Show more<DevotionalIcon name="down" /></button>}</div></>}</main>;
}
function markers(summary: HistoryDaySummary) { return <span className="history-date-marks" aria-hidden="true">{summary.counts.READING_COMPLETED || summary.counts.HIGHLIGHT_CREATED ? <i className="scripture" /> : null}{summary.counts.REFLECTION_CREATED ? <i className="reflection" /> : null}{summary.counts.PRAYER_CREATED || summary.counts.PRAYER_PRAYED || summary.counts.PRAYER_UPDATED || summary.counts.ENCOURAGEMENT_RECORDED ? <i className="prayer" /> : null}{summary.counts.PRAYER_ANSWERED ? <i className="answer" /> : null}</span>; }
export function HistoryCalendarScreen() {
  const { localDate } = useLocalClock(), [params, setParams] = useSearchParams(), location = useLocation(), url = location.pathname + location.search;
  const { data, error, retry } = useHistoryLoad(`calendar|${localDate}`, () => repository.listDaySummaries()), period = parseHistoryQuery(params).period;
  const defaultMonth = period === 'this-year' ? localDate.slice(0, 7) : data?.find(d => period === 'all' || d.localDate.startsWith(`${period}-`))?.localDate.slice(0, 7) ?? (period === 'all' ? localDate.slice(0, 7) : `${period}-01`);
  const month = validMonth(params.get('month')) ? params.get('month')! : defaultMonth;
  useEffect(() => { if (data && params.get('month') !== month) { const next = new URLSearchParams(params); next.set('month', month); setParams(next, { replace: true }); } }, [month, params, setParams, data]);
  useHistoryPosition(url, Boolean(data));
  const changeMonth = (value: string) => { if (!validMonth(value)) return; const next = new URLSearchParams(params); next.set('month', value); setParams(next); };
  const shift = (delta: number) => { const date = dateObject(`${month}-01`); date.setMonth(date.getMonth() + delta); changeMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); };
  const selected = data?.filter(d => d.localDate.startsWith(month)).sort((a, b) => a.localDate.localeCompare(b.localDate)) ?? [], byDate = new Map(selected.map(d => [d.localDate, d]));
  const first = dateObject(`${month}-01`), leading = (first.getDay() + 6) % 7, days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const dayUrl = (date: string) => withHistoryReturn(`/history/day/${date}`, url);
  return <main className="grace-history history-calendar-screen"><Heading title="Browse dates" url={url}><Link className="history-back" to={safeHistoryReturn(params.get('return'))}><DevotionalIcon name="back" />History</Link></Heading><p className="history-intro">All activity, one day at a time.</p><div className="history-month-controls"><button type="button" aria-label="Previous month" onClick={() => shift(-1)}><DevotionalIcon name="back" /></button><h2 aria-live="polite">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(first)}</h2><button type="button" aria-label="Next month" onClick={() => shift(1)}><DevotionalIcon name="chevron" /></button></div><div className="history-month-picker"><label>Month<input type="month" value={month} min="1000-01" max="9999-12" onChange={e => changeMonth(e.target.value)} /></label><button type="button" onClick={() => changeMonth(localDate.slice(0, 7))}>This month</button></div>
    {error && <State error={error} retry={retry} />}{!data && !error ? <State>Opening dates…</State> : data && <div className="history-calendar-container"><div className="history-calendar-grid"><div className="history-weekdays" aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="history-month-grid">{Array.from({ length: Math.ceil((leading + days) / 7) * 7 }, (_, index) => { const day = index - leading + 1; if (day < 1 || day > days) return <span key={index} />; const date = `${month}-${String(day).padStart(2, '0')}` as LocalDate, summary = byDate.get(date); return summary ? <Link id={`history-date-${date}`} className={`history-day${date === localDate ? ' is-today' : ''}`} key={date} to={dayUrl(date)} aria-label={`Open history for ${dateLabel(date)}, ${summary.total} recorded {summary.total === 1 ? 'event' : 'events'}`}><strong>{day}</strong>{markers(summary)}</Link> : <span className="history-day empty" key={date} aria-label={`${dateLabel(date)}, no recorded history`}>{day}</span>; })}</div></div><div className="history-calendar-day-list">{selected.map(day => <Link key={day.localDate} id={`history-list-date-${day.localDate}`} to={dayUrl(day.localDate)}><span>{dateLabel(day.localDate)}{markers(day)}</span><span>{day.total} {day.total === 1 ? 'event' : 'events'}<DevotionalIcon name="chevron" /></span></Link>)}</div>{!selected.length && <State>No activity is recorded in this month.</State>}<div className="history-calendar-legend">{(['Scripture','Reflection','Prayer','Answer'] as const).map(kind => <span key={kind}><span className="history-date-marks" aria-hidden="true"><i className={kind.toLowerCase()} /></span>{kind === 'Answer' ? 'Answers' : kind}</span>)}</div></div>}</main>;
}
function DayEntry({ entry, selected, url, manifest }: { entry: HistoryEntry; selected: boolean; url: string; manifest: BibleManifest | null }) {
  const [expanded, setExpanded] = useState(selected); useEffect(() => { if (selected) setExpanded(true); }, [selected]);
  const text = entry.fullText || entry.body, long = Boolean(text && text.length > 220);
  return <article id={`history-entry-${entry.id}`} tabIndex={-1} className={`history-entry history-day-entry${selected ? ' is-selected' : ''}`}><span className={`history-symbol kind-${entry.kind}`}><DevotionalIcon name={icons[entry.kind]} /></span><div><h2>{entry.title}</h2>{entry.reference && <p className="history-entry-reference">{referenceLabel(entry.reference, manifest)}</p>}{text && <p className="history-entry-text">{expanded ? text : entry.body ?? text}</p>}{long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Show less' : 'Read more'}</button>}{entry.href ? <Link className="history-source-link" to={withHistoryReturn(entry.href, url)}>{entry.kind === 'reflection' ? 'Open reflection' : entry.kind === 'scripture' || entry.kind === 'highlight' ? 'Read passage' : 'Open prayer'}<DevotionalIcon name="arrow" /></Link> : <p className="history-unavailable">{entry.availability === 'removed' ? 'This record was removed. Its recorded activity remains.' : 'The original details are unavailable.'}</p>}</div></article>;
}
export function HistoryDayScreen() {
  const raw = useParams().localDate ?? '', [params] = useSearchParams(), location = useLocation(), clock = useLocalClock(), url = location.pathname + location.search, selected = params.get('entry') ?? '', manifest = useHistoryManifest();
  const { data, error, retry } = useHistoryLoad(`${url}|${clock.localDate}`, () => validDate(raw) ? repository.listDay(raw) : Promise.resolve([]));
  useHistoryPosition(url, Boolean(data), selected);
  const prayed = data?.filter(e => e.eventType === 'PRAYER_PRAYED') ?? [], entries = data?.filter(e => e.eventType !== 'PRAYER_PRAYED') ?? [];
  return <main className="grace-history history-day-screen"><Heading title={validDate(raw) ? dateLabel(raw) : 'Invalid date'} url={url}><Link className="history-back" to={safeHistoryReturn(params.get('return'))}><DevotionalIcon name="back" />Back to History</Link></Heading>{!validDate(raw) ? <State>This history date is not valid.</State> : <>{error && <State error={error} retry={retry} />}{!data && !error ? <State>Opening this day…</State> : data && <>{!data.length && <State>No history is recorded for this date.</State>}{selected && !data.some(e => e.id === selected) && <State>That entry is unavailable. Other recorded activity for this day is shown below.</State>}<div className="history-entry-list">{entries.map(entry => <DayEntry key={entry.id} entry={entry} selected={entry.id === selected} url={url} manifest={manifest} />)}</div>{prayed.length > 0 && <details className="history-prayed-details" open={prayed.some(e => e.id === selected) || undefined}><summary>{prayed.length} recorded prayed {prayed.length === 1 ? 'action' : 'actions'}</summary>{prayed.map(entry => <DayEntry key={entry.id} entry={entry} selected={entry.id === selected} url={url} manifest={manifest} />)}</details>}</>}</>}</main>;
}
