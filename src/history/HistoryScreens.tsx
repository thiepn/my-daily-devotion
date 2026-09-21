import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { EditorialFlourish, MorningLandscape } from "../app/visual/MorningGraceMotifs";
import { db } from "../data/database";
import { assertLocalDate, todayLocalDate } from "../domain/time";
import type { LocalDate, ScriptureReference } from "../domain/types";
import { loadBibleManifest } from "../scripture/loader";
import { parseVerseKey } from "../scripture/repository";
import type { BibleManifest } from "../scripture/types";
import { HistoryRepository, type HistoryDaySummary, type HistoryEntry } from "./repository";

const repository = new HistoryRepository(db);

function monthKey(date: LocalDate): string { return date.slice(0, 7); }
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(y!, m! - 1, 1));
}
function moveMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(y!, m! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function dateLabel(date: LocalDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(y!, m! - 1, d!, 12));
}
function shortDateLabel(date: LocalDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(y!, m! - 1, d!, 12));
}
function referenceLabel(reference: ScriptureReference, manifest: BibleManifest | null): string {
  const start = parseVerseKey(reference.startVerseKey);
  const end = parseVerseKey(reference.endVerseKey);
  const name = manifest?.books.find((book) => book.id === start.bookId)?.name ?? start.bookId;
  return start.chapter === end.chapter
    ? `${name} ${start.chapter}:${start.verse}${start.verse === end.verse ? "" : `–${end.verse}`}`
    : `${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
}

function HistoryTabs({ active, returnTo }: { active: "calendar" | "moments"; returnTo: string }) {
  const searchUrl = `/search?${new URLSearchParams({ return: returnTo }).toString()}`;
  return (
    <nav className="history-tabs" aria-label="History views">
      <Link aria-current={active === "calendar" ? "page" : undefined} className={active === "calendar" ? "is-active" : ""} to="/history">Overview</Link>
      <Link aria-current={active === "moments" ? "page" : undefined} className={active === "moments" ? "is-active" : ""} to="/history/moments">Moments</Link>
      <Link to={searchUrl}>Search</Link>
    </nav>
  );
}

function markers(summary: HistoryDaySummary | undefined) {
  if (!summary) return null;
  return (
    <span className="history-day-marks" aria-label={`${summary.total} history events`}>
      {summary.counts.READING_COMPLETED ? <i className="mark-scripture" aria-hidden="true" /> : null}
      {summary.counts.REFLECTION_CREATED ? <i className="mark-reflection" aria-hidden="true" /> : null}
      {summary.counts.PRAYER_ANSWERED ? <i className="mark-answer" aria-hidden="true" /> : summary.counts.PRAYER_CREATED || summary.counts.PRAYER_PRAYED ? <i className="mark-prayer" aria-hidden="true" /> : null}
    </span>
  );
}

export function HistoryScreen() {
  const today = todayLocalDate();
  const [month, setMonth] = useState(monthKey(today));
  const [summaries, setSummaries] = useState<HistoryDaySummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    void repository.listDaySummaries(month)
      .then((items) => { if (!cancelled) setSummaries(items); })
      .catch(() => { if (!cancelled) setError("Could not open history. Reload to try again."); });
    return () => { cancelled = true; };
  }, [month]);

  const byDate = useMemo(() => new Map(summaries.map((item) => [item.localDate, item])), [summaries]);
  const activeDays = summaries.filter((item) => item.total > 0).length;
  const totalEvents = summaries.reduce((sum, item) => sum + item.total, 0);
  const prayerDays = summaries.filter((item) => item.counts.PRAYER_CREATED || item.counts.PRAYER_PRAYED || item.counts.PRAYER_ANSWERED).length;
  const recentDays = useMemo(() => [...summaries].filter((item) => item.total > 0).sort((a, b) => b.localDate.localeCompare(a.localDate)).slice(0, 4), [summaries]);

  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year!, monthNumber! - 1, 1);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(year!, monthNumber!, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - leading + 1;
    return day >= 1 && day <= days ? day : null;
  });

  return (
    <main className="visual-screen history-screen live-history-screen mg-canonical-screen">
      <header className="mg-canonical-hero mg-history-hero">
        <div className="mg-hero-copy">
          <p className="eyebrow">Look back and see</p>
          <h1>History</h1>
          <p className="screen-intro">A quiet record of Scripture, reflection, prayer, and God’s faithfulness over time.</p>
          <HistoryTabs active="calendar" returnTo="/history" />
        </div>
        <div className="mg-history-hero-art" aria-hidden="true"><MorningLandscape /></div>
      </header>

      {error ? <p role="alert">{error}</p> : null}

      <section className="mg-history-overview" aria-labelledby="history-overview-heading">
        <div className="mg-section-title-row">
          <div>
            <p className="section-kicker">This month</p>
            <h2 id="history-overview-heading">A record of grace.</h2>
          </div>
          <EditorialFlourish />
        </div>
        <div className="mg-history-stats">
          <div><strong>{activeDays}</strong><span>days with history</span></div>
          <div><strong>{totalEvents}</strong><span>recorded events</span></div>
          <div><strong>{prayerDays}</strong><span>days with prayer</span></div>
        </div>
        {recentDays.length ? (
          <div className="mg-history-recent">
            <p className="section-kicker">Recent activity</p>
            <div>
              {recentDays.map((summary) => (
                <Link to={`/history/day/${summary.localDate}`} key={summary.localDate}>
                  <time>{shortDateLabel(summary.localDate)}</time>
                  <span>{markers(summary)}<strong>{summary.total} {summary.total === 1 ? "moment" : "moments"}</strong></span>
                  <Icon name="arrow" />
                </Link>
              ))}
            </div>
          </div>
        ) : <p className="muted-copy">Your devotional history for this month will gather here as you read, reflect, and pray.</p>}
      </section>

      <section className="history-calendar mg-history-calendar" aria-labelledby="history-calendar-heading">
        <div className="history-month-heading">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(moveMonth(month, -1))}>←</button>
          <h2 id="history-calendar-heading" aria-live="polite">{monthLabel(month)}</h2>
          <button type="button" aria-label="Next month" onClick={() => setMonth(moveMonth(month, 1))}>→</button>
        </div>
        <div className="history-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="history-month-grid">
          {cells.map((day, index) => {
            if (!day) return <span className="history-day blank" aria-hidden="true" key={index} />;
            const date = `${month}-${String(day).padStart(2, "0")}` as LocalDate;
            const summary = byDate.get(date);
            return summary ? (
              <Link aria-label={`Open history for ${dateLabel(date)}`} className={`history-day${date === today ? " is-today" : ""}`} to={`/history/day/${date}`} key={date}>
                <strong>{day}</strong>{markers(summary)}
              </Link>
            ) : (
              <span className={`history-day empty${date === today ? " is-today" : ""}`} aria-label={`${dateLabel(date)}, no recorded history`} key={date}><strong>{day}</strong></span>
            );
          })}
        </div>
        <p className="history-calendar-legend">
          <span><i className="mark-scripture" aria-hidden="true" /> Scripture</span>
          <span><i className="mark-reflection" aria-hidden="true" /> Reflection</span>
          <span><i className="mark-prayer" aria-hidden="true" /> Prayer</span>
          <span><i className="mark-answer" aria-hidden="true" /> Answer</span>
        </p>
      </section>

      <aside className="mg-history-closing" aria-label="History reflection">
        <MorningLandscape aria-hidden="true" />
        <p>Small days become a record of His faithfulness.</p>
      </aside>
    </main>
  );
}

function EntryView({ entry, manifest }: { entry: HistoryEntry; manifest: BibleManifest | null }) {
  return (
    <article className={`history-entry kind-${entry.kind}`}>
      <span className="history-entry-mark" aria-hidden="true" />
      <div>
        <p>{entry.title}</p>
        {entry.reference ? <strong>{referenceLabel(entry.reference, manifest)}</strong> : null}
        {entry.body ? <blockquote>{entry.body}</blockquote> : null}
        {entry.href ? <Link to={entry.href} aria-label={`Open ${entry.reference ? referenceLabel(entry.reference, manifest) : entry.title}`}>Open →</Link> : null}
      </div>
    </article>
  );
}

export function HistoryDayScreen() {
  const raw = useParams().localDate ?? "";
  let localDate: LocalDate | null = null;
  try { assertLocalDate(raw); localDate = raw; } catch { /* invalid deep link */ }

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  const [loading, setLoading] = useState(Boolean(localDate));
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!localDate) { setLoading(false); return () => { cancelled = true; }; }
    setLoading(true);
    setError("");
    void Promise.all([repository.listDay(localDate), loadBibleManifest()])
      .then(([items, bible]) => { if (!cancelled) { setEntries(items); setManifest(bible); } })
      .catch(() => { if (!cancelled) setError("Could not open this day. Reload to try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [localDate]);

  if (!localDate) return <main className="visual-screen"><h1>Invalid date</h1><Link to="/history">Return to History</Link></main>;

  const prayed = entries.filter((item) => item.eventType === "PRAYER_PRAYED");
  const visible = entries.filter((item) => item.eventType !== "PRAYER_PRAYED");

  return (
    <main className="visual-screen history-day-screen mg-secondary-screen mg-history-detail-workspace">
      <header className="screen-heading compact-heading mg-secondary-header">
        <p className="eyebrow">History · {dateLabel(localDate)}</p>
        <h1>{localDate.slice(8)}</h1>
        <p className="screen-intro">Scripture, reflections and prayers from this day.</p>
        <Link className="quiet-back-link" to="/history">← Calendar</Link>
      </header>
      {error ? <p role="alert">{error}</p> : loading ? <p className="history-loading" role="status">Opening history…</p> : (
        <>
          {prayed.length ? <section className="history-prayer-summary"><p className="section-kicker">Prayer</p><strong>{prayed.length}</strong><span>{prayed.length === 1 ? "prayer prayed" : "prayers prayed"}</span></section> : null}
          <section className="history-entry-list">{visible.length ? visible.map((entry) => <EntryView key={entry.id} entry={entry} manifest={manifest} />) : <p className="muted-copy">No further history is recorded for this date.</p>}</section>
        </>
      )}
    </main>
  );
}

export function HistoryMomentsScreen() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [manifest, setManifest] = useState<BibleManifest | null>(null);

  useEffect(() => {
    void Promise.all([repository.listMoments(), loadBibleManifest()])
      .then(([items, bible]) => { setEntries(items); setManifest(bible); })
      .catch(() => setError("Could not open moments. Reload to try again."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="visual-screen history-screen mg-secondary-screen mg-history-detail-workspace">
      <header className="screen-heading compact-heading mg-secondary-header">
        <p className="eyebrow">Remember</p>
        <h1>Moments</h1>
        <p className="screen-intro">Reflections, meaningful passages and answers to return to.</p>
      </header>
      <HistoryTabs active="moments" returnTo="/history/moments" />
      <section className="moments-list">
        {error ? <p role="alert">{error}</p> : loading ? <p role="status">Opening moments…</p> : entries.length ? entries.map((entry) => <div className="moment-row" key={entry.id}><time>{entry.localDate}</time><EntryView entry={entry} manifest={manifest} /></div>) : <p className="muted-copy">Meaningful moments will appear here as your devotional history grows.</p>}
      </section>
    </main>
  );
}
