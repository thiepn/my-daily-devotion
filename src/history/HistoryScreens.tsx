import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../data/database";
import { todayLocalDate } from "../domain/time";
import type { LocalDate, ScriptureReference } from "../domain/types";
import { loadBibleManifest } from "../scripture/loader";
import { parseVerseKey } from "../scripture/repository";
import type { BibleManifest } from "../scripture/types";
import { HistoryRepository, type HistoryDaySummary, type HistoryEntry } from "./repository";

const repository = new HistoryRepository(db);
function monthKey(date: LocalDate): string { return date.slice(0, 7); }
function monthLabel(key: string): string { const [y,m]=key.split("-").map(Number); return new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(new Date(y!,m!-1,1)); }
function moveMonth(key: string, delta: number): string { const [y,m]=key.split("-").map(Number); const date=new Date(y!,m!-1+delta,1); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function dateLabel(date: LocalDate): string { const [y,m,d]=date.split("-").map(Number); return new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(y!,m!-1,d!,12)); }
function referenceLabel(reference: ScriptureReference, manifest: BibleManifest | null): string { const start=parseVerseKey(reference.startVerseKey); const end=parseVerseKey(reference.endVerseKey); const name=manifest?.books.find((book)=>book.id===start.bookId)?.name??start.bookId; return start.chapter===end.chapter?`${name} ${start.chapter}:${start.verse}${start.verse===end.verse?"":`–${end.verse}`}`:`${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`; }
function HistoryTabs({active}:{active:"calendar"|"moments"}) { return <nav className="history-tabs" aria-label="History views"><Link aria-current={active==="calendar"?"page":undefined} className={active==="calendar"?"is-active":""} to="/history">Calendar</Link><Link aria-current={active==="moments"?"page":undefined} className={active==="moments"?"is-active":""} to="/history/moments">Moments</Link><Link to="/search">Search</Link></nav>; }
function markers(summary: HistoryDaySummary | undefined) { if(!summary)return null; return <span className="history-day-marks" aria-label={`${summary.total} history events`}>{summary.counts.READING_COMPLETED?<i className="mark-scripture" aria-hidden="true"/>:null}{summary.counts.REFLECTION_CREATED?<i className="mark-reflection" aria-hidden="true"/>:null}{summary.counts.PRAYER_ANSWERED?<i className="mark-answer" aria-hidden="true"/>:summary.counts.PRAYER_CREATED||summary.counts.PRAYER_PRAYED?<i className="mark-prayer" aria-hidden="true"/>:null}</span>; }

export function HistoryScreen(){
 const today=todayLocalDate(); const [month,setMonth]=useState(monthKey(today)); const [summaries,setSummaries]=useState<HistoryDaySummary[]>([]); useEffect(()=>{void repository.listDaySummaries().then(setSummaries);},[]); const byDate=useMemo(()=>new Map(summaries.map((item)=>[item.localDate,item])),[summaries]); const [year,monthNumber]=month.split("-").map(Number); const first=new Date(year!,monthNumber!-1,1); const leading=(first.getDay()+6)%7; const days=new Date(year!,monthNumber!,0).getDate(); const cells=Array.from({length:42},(_,index)=>{const day=index-leading+1;return day>=1&&day<=days?day:null;});
 return <main className="visual-screen history-screen live-history-screen"><header className="screen-heading compact-heading"><p className="eyebrow">Remember</p><h1>History</h1><p className="screen-intro">An automatic record of Scripture, reflection, prayer and answers. Empty days are simply empty; they are not failures.</p></header><HistoryTabs active="calendar"/><section className="history-calendar"><div className="history-month-heading"><button type="button" aria-label="Previous month" onClick={()=>setMonth(moveMonth(month,-1))}>←</button><h2 aria-live="polite">{monthLabel(month)}</h2><button type="button" aria-label="Next month" onClick={()=>setMonth(moveMonth(month,1))}>→</button></div><div className="history-weekdays" aria-hidden="true">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day)=><span key={day}>{day}</span>)}</div><div className="history-month-grid">{cells.map((day,index)=>{if(!day)return <span className="history-day blank" aria-hidden="true" key={index}/>;const date=`${month}-${String(day).padStart(2,"0")}` as LocalDate;const summary=byDate.get(date);return summary?<Link aria-label={`Open history for ${dateLabel(date)}`} className={`history-day${date===today?" is-today":""}`} to={`/history/day/${date}`} key={date}><strong>{day}</strong>{markers(summary)}</Link>:<span className={`history-day empty${date===today?" is-today":""}`} aria-label={`${dateLabel(date)}, no recorded history`} key={date}><strong>{day}</strong></span>;})}</div><p className="history-calendar-legend"><span><i className="mark-scripture" aria-hidden="true"/> Scripture</span><span><i className="mark-reflection" aria-hidden="true"/> Reflection</span><span><i className="mark-prayer" aria-hidden="true"/> Prayer</span><span><i className="mark-answer" aria-hidden="true"/> Answer</span></p></section></main>;
}
function EntryView({entry,manifest}:{entry:HistoryEntry;manifest:BibleManifest|null}){return <article className={`history-entry kind-${entry.kind}`}><span className="history-entry-mark" aria-hidden="true"/><div><p>{entry.title}</p>{entry.reference?<strong>{referenceLabel(entry.reference,manifest)}</strong>:null}{entry.body?<blockquote>{entry.body}</blockquote>:null}{entry.href?<Link to={entry.href}>Open →</Link>:null}</div></article>;}
export function HistoryDayScreen(){
  const raw=useParams().localDate??"";
  const localDate=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw as LocalDate:null;
  const[entries,setEntries]=useState<HistoryEntry[]>([]);
  const[manifest,setManifest]=useState<BibleManifest|null>(null);
  const[loading,setLoading]=useState(Boolean(localDate));
  useEffect(()=>{
    let cancelled=false;
    if(!localDate){setLoading(false);return()=>{cancelled=true;};}
    setLoading(true);
    void Promise.all([repository.listDay(localDate),loadBibleManifest()]).then(([items,bible])=>{if(!cancelled){setEntries(items);setManifest(bible);}}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[localDate]);
  if(!localDate)return <main className="visual-screen"><h1>Invalid date</h1><Link to="/history">Return to History</Link></main>;
  const prayed=entries.filter((item)=>item.eventType==="PRAYER_PRAYED");
  const visible=entries.filter((item)=>item.eventType!=="PRAYER_PRAYED");
  return <main className="visual-screen history-day-screen"><header className="screen-heading compact-heading"><p className="eyebrow">History · {dateLabel(localDate)}</p><h1>{localDate.slice(8)}</h1><p className="screen-intro">What MDD recorded on this date, assembled from the original local records.</p><Link className="quiet-back-link" to="/history">← Calendar</Link></header>{loading?<p className="history-loading" role="status">Opening history…</p>:<>{prayed.length?<section className="history-prayer-summary"><p className="section-kicker">Prayer</p><strong>{prayed.length}</strong><span>{prayed.length===1?"prayer prayed":"prayers prayed"}</span></section>:null}<section className="history-entry-list">{visible.length?visible.map((entry)=><EntryView key={entry.id} entry={entry} manifest={manifest}/>):<p className="muted-copy">No meaningful history is recorded for this date.</p>}</section></>}</main>;
}
export function HistoryMomentsScreen(){const[entries,setEntries]=useState<HistoryEntry[]>([]);const[manifest,setManifest]=useState<BibleManifest|null>(null);useEffect(()=>{void Promise.all([repository.listMoments(),loadBibleManifest()]).then(([items,bible])=>{setEntries(items);setManifest(bible);});},[]);return <main className="visual-screen history-screen"><header className="screen-heading compact-heading"><p className="eyebrow">Remember</p><h1>Moments</h1><p className="screen-intro">Reflections, highlights, prayer developments and answers worth seeing again—without engagement prompts or a spiritual score.</p></header><HistoryTabs active="moments"/><section className="moments-list">{entries.length?entries.map((entry)=><div className="moment-row" key={entry.id}><time>{entry.localDate}</time><EntryView entry={entry} manifest={manifest}/></div>):<p className="muted-copy">Meaningful moments will appear here as your devotional history grows.</p>}</section></main>;}
