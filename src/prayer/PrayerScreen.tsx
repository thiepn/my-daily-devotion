import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { BotanicalSprig, EditorialFlourish } from "../app/visual/MorningGraceMotifs";
import { db } from "../data/database";
import { PrayerSessionRepository } from "../data/repositories/prayer-sessions";
import { PrayerRepository } from "../data/repositories/prayers";
import { useLocalClock } from "../app/useLocalClock";
import type { Prayer, PrayerSession, PrayerStatus } from "../domain/types";

const repository = new PrayerRepository(db);
const sessions = new PrayerSessionRepository(db);
const statuses: PrayerStatus[] = ["ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"];
const labels: Record<PrayerStatus, string> = { ACTIVE: "Active", WAITING: "Waiting", ANSWERED: "Answered", ARCHIVED: "Archived" };

function lastPrayedLabel(prayer: Prayer): string {
  if (!prayer.lastPrayedAt) return "Not prayed in MDD yet";
  return `Last prayed ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(prayer.lastPrayedAt))}`;
}

export function PrayerScreen() {
  const { localDate: today } = useLocalClock();
  const [params] = useSearchParams();
  const requested = params.get("status")?.toUpperCase() as PrayerStatus | undefined;
  const selected: PrayerStatus = requested && statuses.includes(requested) ? requested : "ACTIVE";
  const [items, setItems] = useState<Prayer[]>([]);
  const [all, setAll] = useState<Prayer[]>([]);
  const [openSession, setOpenSession] = useState<PrayerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [nextItems, nextAll, session] = await Promise.all([
      repository.listByStatus(selected),
      repository.listActive(),
      sessions.getOpenSession(),
    ]);
    setItems(nextItems);
    setAll(nextAll);
    setOpenSession(session?.localDate === today ? session : null);
    setLoading(false);
  }, [selected, today]);

  useEffect(() => {
    void refresh().catch(() => {
      setError("Could not open prayers. Reload to try again.");
      setLoading(false);
    });
  }, [refresh]);

  const counts = useMemo(
    () => Object.fromEntries(statuses.map((status) => [status, all.filter((item) => item.status === status).length])) as Record<PrayerStatus, number>,
    [all],
  );

  return (
    <main className="visual-screen prayer-screen live-prayer-screen mg-canonical-screen">
      <header className="mg-canonical-hero mg-prayer-hero">
        <div className="mg-hero-copy">
          <p className="eyebrow">Bring it to Him</p>
          <h1>Prayer</h1>
          <p className="screen-intro">People, needs, gratitude, and ordinary days belong here.</p>
          <div className="prayer-primary-actions">
            <Link className="primary-editorial-action compact-action" to="/prayer/new"><Icon name="plus" /> Add prayer</Link>
            {openSession
              ? <Link className="prayer-now-link" to={`/prayer/session?depth=${openSession.depth}`}>Resume session</Link>
              : counts.ACTIVE > 0
                ? <Link className="prayer-now-link" to="/prayer/session?depth=quick">Pray now</Link>
                : null}
          </div>
          <div className="prayer-management-links"><Link to="/prayer/people"><Icon name="people" /> People</Link><Link to="/prayer/categories">Categories</Link></div>
        </div>
        <div className="mg-prayer-hero-art" aria-hidden="true">
          <BotanicalSprig />
          <p>“Bring everything to God.”</p>
          <span>Philippians 4:6</span>
        </div>
      </header>

      {counts.ACTIVE > 0 ? (
        <section className="prayer-session-choices mg-prayer-focus" aria-label="Focused prayer depth">
          <div className="mg-prayer-focus-copy">
            <p className="section-kicker">Focused prayer</p>
            <h2>{openSession ? "Continue where you stopped." : "Set aside a few quiet minutes."}</h2>
            {openSession ? <p className="session-resume-note">Your unfinished {openSession.depth} session from today is preserved. Your place is saved.</p> : <p className="muted-copy">The queue brings focused and due requests first, then rotates through the rest.</p>}
          </div>
          <div className="mg-session-depths">
            <Link to="/prayer/session?depth=quick"><strong>Quick</strong><span>about 4 requests</span><Icon name="arrow" /></Link>
            <Link to="/prayer/session?depth=regular"><strong>Regular</strong><span>about 10 requests</span><Icon name="arrow" /></Link>
            <Link to="/prayer/session?depth=extended"><strong>Extended</strong><span>about 20 requests</span><Icon name="arrow" /></Link>
          </div>
          <small className="session-depth-note">Focused and due requests may make a session longer.</small>
        </section>
      ) : null}

      <section className="mg-prayer-library" aria-labelledby="prayer-list-heading">
        <div className="mg-section-title-row">
          <div>
            <p className="section-kicker">Prayer list</p>
            <h2 id="prayer-list-heading">What you’re carrying.</h2>
          </div>
          <EditorialFlourish />
        </div>

        <nav className="prayer-status-tabs" aria-label="Prayer status">
          {statuses.map((status) => (
            <Link key={status} aria-current={selected === status ? "page" : undefined} className={selected === status ? "is-active" : ""} to={`/prayer?status=${status}`}>
              <span>{labels[status]}</span><small>{counts[status]}</small>
            </Link>
          ))}
        </nav>

        <section className="prayer-live-list" aria-live="polite">
          {error ? <p className="mg-inline-state mg-error-state" role="alert">{error}</p> : loading ? <p className="muted-copy mg-inline-state mg-loading-state">Opening prayers…</p> : items.length === 0 ? (
            <div className="prayer-empty mg-prayer-empty mg-empty-state">
              <BotanicalSprig aria-hidden="true" />
              <h2>No {labels[selected].toLowerCase()} prayers.</h2>
              <p>{selected === "ACTIVE" ? "Add a request when there is something you genuinely want to carry into prayer." : "Nothing needs to be here."}</p>
              {selected === "ACTIVE" ? <Link to="/prayer/new">Add prayer →</Link> : null}
            </div>
          ) : items.map((prayer) => (
            <Link className="prayer-live-row mg-prayer-row" to={`/prayer/${prayer.id}`} key={prayer.id}>
              <span className="mg-prayer-row-icon" aria-hidden="true"><Icon name={prayer.status === "ANSWERED" ? "answered" : "prayer"} /></span>
              <div>
                <span className={`prayer-status-word status-${prayer.status.toLowerCase()}`}>{labels[prayer.status]}</span>
                <p>{prayer.body}</p>
                <small>{lastPrayedLabel(prayer)}</small>
              </div>
              <Icon name="arrow" />
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
