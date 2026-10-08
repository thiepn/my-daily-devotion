import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { JournalHeading } from '../writing/JournalPrimitives';
import { useLocalClock } from '../app/useLocalClock';
import { db } from '../data/database';
import { useRememberChoices } from './RememberChoices';
import { useHistoryLoad, useHistoryManifest, useHistoryPosition } from './hooks';
import { safeHistoryReturn, withHistoryReturn } from './journal';
import { HistoryFeed } from './HistoryScreens';
import { loadAnniversaries } from './remember';
import { reviewShown } from './review';
export function AnniversaryScreen() {
  const { state } = useRememberChoices(), { localDate } = useLocalClock(), location = useLocation(), [params, setParams] = useSearchParams();
  const url = location.pathname + location.search, shown = reviewShown(params.get('shown')), manifest = useHistoryManifest(), enabled = Boolean(state.value?.anniversaries);
  const result = useHistoryLoad(`anniversary-view|${localDate}|${enabled}|${shown}`, () => enabled ? loadAnniversaries(db, localDate, shown) : Promise.resolve(null));
  useHistoryPosition(url, Boolean(result.data) || !enabled);
  return <main className="journal-workspace grace-history anniversary-screen"><JournalHeading title="On this day" subtitle="A moment to revisit" back={safeHistoryReturn(params.get('return'))} />
    <p>Revisit reflections, answers, encouragement and highlights from this date in earlier years. Excerpts show your current saved writing.</p>
    {!enabled ? <p role="status">On this day is off.<Link to={withHistoryReturn('/data?section=privacy', url)}>Open your optional choices</Link></p> : <>
      {result.error && <div role="alert"><p>{result.error}</p><button onClick={result.retry}>Retry moments</button></div>}
      {!result.data && !result.error && <p role="status">Opening these moments…</p>}
      {result.data && <>{result.data.entries.length ? <HistoryFeed rows={result.data.entries.map(entry => ({ id: entry.id, eventIds: [entry.id], entry, localDate: entry.localDate, occurredAt: entry.occurredAt }))} today={localDate} url={url} manifest={manifest} /> : <p>No saved moments are available for this date in earlier years.</p>}<div className="history-list-footer"><span role="status">Showing {result.data.entries.length} of {result.data.total} moments</span>{result.data.entries.length < result.data.total && <button onClick={() => { const next = new URLSearchParams(params); next.set('shown', String(shown+20)); setParams(next); }}>Show more</button>}</div></>}
    </>}<Link to={withHistoryReturn('/data?section=privacy', url)}>Manage remembering choices</Link>
  </main>;
}
