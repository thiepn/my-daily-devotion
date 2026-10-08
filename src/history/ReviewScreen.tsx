import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { MorningGraceArtwork } from '../app/visual/MorningGraceArtwork';
import { useLocalClock } from '../app/useLocalClock';
import { db } from '../data/database';
import { HistoryFeed } from './HistoryScreens';
import { useHistoryLoad, useHistoryManifest, useHistoryPosition } from './hooks';
import { safeHistoryReturn, withHistoryReturn } from './journal';
import { loadJournalReview, moveJournalDate, parseJournalRange, previousCompletedWeek, reviewShown, validJournalDate, weekContaining } from './review';

function label(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
export function HistoryReviewScreen({ rangeMode = false }: { rangeMode?: boolean }) {
  const { localDate } = useLocalClock(), location = useLocation(), [params, setParams] = useSearchParams();
  const url = location.pathname + location.search, manifest = useHistoryManifest();
  const selectedWeek = params.get('week');
  const range = rangeMode ? parseJournalRange(params.get('from'), params.get('to'))
    : validJournalDate(selectedWeek) ? weekContaining(selectedWeek) : previousCompletedWeek(localDate);
  const shown = reviewShown(params.get('shown'));
  const [from, setFrom] = useState(range?.from ?? ''), [to, setTo] = useState(range?.to ?? ''), [formError, setFormError] = useState('');
  const key = `${rangeMode}|${range?.from}|${range?.to}|${shown}|${localDate}`;
  const result = useHistoryLoad(key, () => range ? loadJournalReview(db, range, localDate, shown) : Promise.resolve(null));
  useHistoryPosition(url, Boolean(result.data) || !range);
  useEffect(() => { setFrom(range?.from ?? ''); setTo(range?.to ?? ''); setFormError(''); }, [range?.from, range?.to]);
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (!rangeMode && range && next.has('week') && next.get('week') !== range.from) next.set('week', range.from);
    if (next.has('shown') && next.get('shown') !== String(shown)) next.set('shown', String(shown));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [params, setParams, rangeMode, range?.from, shown]);
  const chooseWeek = (value: string) => {
    if (!validJournalDate(value)) return;
    const next = new URLSearchParams(params); next.set('week', weekContaining(value).from); next.delete('shown'); setParams(next);
  };
  const chooseRange = (event: FormEvent) => {
    event.preventDefault();
    if (!parseJournalRange(from, to)) { setFormError('Choose valid dates, with the end on or after the start.'); return; }
    const next = new URLSearchParams(params); next.set('from', from); next.set('to', to); next.delete('shown'); setParams(next);
  };
  return <main className="grace-history history-review-screen">
    <header className="history-journal-heading"><div><Link id="history-review-back" className="history-back" to={safeHistoryReturn(params.get('return'))}>← History</Link><h1>{rangeMode ? 'A chapter to revisit' : 'A week to remember'}</h1></div><MorningGraceArtwork variant="botanical" /></header>
    <p className="history-intro">Your saved readings, reflections, prayers, and Scripture. A record to revisit at your own pace.</p>
    {rangeMode ? <form className="history-review-controls grace-paper" onSubmit={chooseRange}><label>From<input type="date" required value={from} onChange={event => setFrom(event.target.value)} /></label><label>Through<input type="date" required value={to} onChange={event => setTo(event.target.value)} /></label><button type="submit">Open this chapter</button>{formError && <p role="alert">{formError}</p>}</form>
      : <section className="history-review-controls grace-paper" aria-label="Choose a week"><label>Week containing<input type="date" value={range?.from ?? ''} onChange={event => chooseWeek(event.target.value)} /></label><div className="history-review-week-actions"><button onClick={() => range && chooseWeek(moveJournalDate(range.from, -7))}>Previous week</button><button onClick={() => chooseWeek(previousCompletedWeek(localDate).from)}>Last complete week</button><button onClick={() => range && chooseWeek(moveJournalDate(range.from, 7))}>Next week</button></div></section>}
    {range && <h2 className="history-review-period">{label(range.from)} – {label(range.to)}</h2>}
    {!range ? <p className="history-journal-state" role="status">Choose the first and last date. Both dates are included.</p> : <>
      {!result.data && !result.error && <p className="history-journal-state" role="status">Opening this chapter…</p>}
      {result.error && <div className="history-journal-state" role="alert"><p>{result.error}</p><button onClick={result.retry}>Try again</button></div>}
      {result.data && <><p className="history-review-explanation">These entries use their recorded devotional dates. Excerpts show current saved writing; removed records keep their historical entry without private text.</p>
        {result.data.rows.length ? <HistoryFeed rows={result.data.rows} today={localDate} url={url} manifest={manifest} /> : <div className="history-journal-empty"><h2>A quiet chapter.</h2><p>No activity is recorded in these dates. You can choose another period.</p></div>}
        <div className="history-list-footer"><span role="status">Showing {result.data.rows.length} of {result.data.total} entries</span>{result.data.rows.length < result.data.total && <button id="history-review-more" onClick={() => { const next = new URLSearchParams(params); next.set('shown', String(shown + 20)); setParams(next); }}>Show more</button>}</div></>}
    </>}
    <div className="history-review-links"><Link to={withHistoryReturn(rangeMode ? '/history/review' : `/history/range${range ? `?from=${range.from}&to=${range.to}` : ''}`, url)}>{rangeMode ? 'Weekly review' : 'Choose a date range'}</Link><Link to={withHistoryReturn('/history/calendar', url)}>Browse dates</Link></div>
  </main>;
}
