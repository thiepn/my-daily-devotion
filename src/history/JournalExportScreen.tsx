import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { JournalHeading, WritingPreview } from '../writing/JournalPrimitives';
import { useLocalClock } from '../app/useLocalClock';
import { db } from '../data/database';
import { useHistoryLoad, useHistoryPosition } from './hooks';
import { parseJournalRange, previousCompletedWeek } from './review';
import { safeHistoryReturn, withHistoryReturn } from './journal';
import { journalReference, journalSections, journalSectionLabels, loadSelectedJournal, parseJournalSections, selectedJournalMarkdown } from './journal-export';

export function JournalExportScreen() {
  const { localDate } = useLocalClock(), location = useLocation(), [params, setParams] = useSearchParams();
  const fallback = previousCompletedWeek(localDate);
  const range = params.has('from') || params.has('to') ? parseJournalRange(params.get('from'), params.get('to')) : fallback;
  const [from, setFrom] = useState(range?.from ?? ''), [to, setTo] = useState(range?.to ?? ''), [formError, setFormError] = useState(''), [status, setStatus] = useState('');
  const [sections, setSections] = useState(() => parseJournalSections(params.get('sections'))), url = location.pathname + location.search;
  const selectedSections = params.get('sections');
  useEffect(() => { setSections(parseJournalSections(selectedSections)); }, [selectedSections]);
  const key = `${range?.from}|${range?.to}|${sections.join(',')}`;
  const result = useHistoryLoad(key, () => range ? loadSelectedJournal(db, range, sections) : Promise.resolve(null));
  useEffect(() => { setFrom(range?.from ?? ''); setTo(range?.to ?? ''); setStatus(''); setFormError(''); }, [range?.from, range?.to]);
  useHistoryPosition(url, Boolean(result.data) || !range);
  const choose = (event: FormEvent) => {
    event.preventDefault(); if (!parseJournalRange(from, to)) { setFormError('Choose valid dates, with the end on or after the start.'); return; }
    const next = new URLSearchParams(params); next.set('from', from); next.set('to', to); setParams(next); setFormError(''); setStatus('');
  };
  const download = () => {
    if (!result.data || result.error) return;
    try {
      const href = URL.createObjectURL(new Blob([selectedJournalMarkdown(result.data)], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = `mdd-journal-${result.data.range.from}-through-${result.data.range.to}.md`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); setStatus('Download requested. This journal file is unencrypted.');
    } catch { setStatus('Could not request a download. Your journal is unchanged; you can copy the preview.'); }
  };
  return <main className="journal-workspace journal-export grace-history">
    <div className="journal-export-controls"><JournalHeading title="Keep a chapter" subtitle="Your journal, to carry with you" back={safeHistoryReturn(params.get('return'))} />
      <p className="journal-export-intro">Choose saved writing and Scripture references to read, print, or save as PDF. This is an unencrypted reading copy, separate from a complete backup.</p>
      <form className="journal-paper history-review-controls" onSubmit={choose}><label>From<input type="date" required value={from} onChange={event => setFrom(event.target.value)} /></label><label>Through<input type="date" required value={to} onChange={event => setTo(event.target.value)} /></label><button type="submit">Preview these dates</button>{formError && <p role="alert">{formError}</p>}</form>
      <fieldset className="journal-export-selection journal-paper"><legend>Include in this copy</legend>{journalSections.map(section => <label key={section}><input type="checkbox" checked={sections.includes(section)} onChange={event => {
        const checked = event.target.checked;
        const chosen = journalSections.filter(value => value === section ? checked : sections.includes(value));
        setSections(chosen); const next = new URLSearchParams(params); next.set('sections', chosen.join(',')); setParams(next); setStatus('');
      }} />{journalSectionLabels[section]}</label>)}</fieldset>
      <p className="journal-help">Selection uses recorded devotional dates and current saved writing. Removed sources are omitted. Drafts, recovery history, person notes and settings are excluded. Prayer updates and answers appear separately from their original requests.</p>
      {!range && <p role="status">Choose a valid first and last date. Both dates are included.</p>}
      {range && !result.data && !result.error && <p role="status">Preparing your reading copy…</p>}
      {result.error && <div role="alert"><p>{result.error}</p><button onClick={result.retry}>Retry preview</button></div>}
      {result.data && <><div className="journal-actions"><button className="grace-primary" disabled={!result.data.entries.length || Boolean(result.error)} onClick={() => { window.print(); setStatus('Print dialog requested. Choose Save as PDF if your browser offers it.'); }}>Print / Save as PDF</button><button disabled={!result.data.entries.length || Boolean(result.error)} onClick={download}>Download selected Markdown</button></div><p role="status">{status || `${result.data.entries.length} entries selected${result.data.unavailable ? ` · ${result.data.unavailable} unavailable sources omitted` : ''}`}</p></>}
    </div>
    {result.data && <section className="journal-export-preview journal-paper" aria-label="Selected journal preview"><header><p className="journal-kicker">MY DAILY DEVOTION</p><h2>A chapter of grace</h2><p>{result.data.range.from} through {result.data.range.to}</p></header>
      {result.data.entries.length ? result.data.entries.map(entry => <article className="journal-export-entry" key={entry.id}><time dateTime={entry.localDate}>{entry.localDate}</time><h3>{entry.title}</h3>{journalReference(entry) && <p className="journal-export-reference">{journalReference(entry)}</p>}{entry.fullText ? entry.kind === 'reflection' || entry.kind === 'answer' ? <WritingPreview text={entry.fullText} /> : <p className="journal-export-writing">{entry.fullText}</p> : entry.kind !== 'scripture' && <p className="journal-help">No saved text.</p>}<Link className="journal-export-source" to={withHistoryReturn(`/history/day/${entry.localDate}?entry=${encodeURIComponent(entry.id)}`, url)}>Open this entry</Link></article>) : <p>No saved entries match these dates and content choices. Choose another period or section.</p>}
    </section>}
  </main>;
}
