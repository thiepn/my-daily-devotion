import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { db } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";
import type { Prayer, PrayerStatus } from "../domain/types";

const repository = new PrayerRepository(db);
const statuses: PrayerStatus[] = ["ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"];
const labels: Record<PrayerStatus, string> = { ACTIVE: "Active", WAITING: "Waiting", ANSWERED: "Answered", ARCHIVED: "Archived" };

function lastPrayedLabel(prayer: Prayer): string {
  if (!prayer.lastPrayedAt) return "Not prayed in MDD yet";
  return `Last prayed ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(prayer.lastPrayedAt))}`;
}

export function PrayerScreen() {
  const [params] = useSearchParams();
  const requested = params.get("status")?.toUpperCase() as PrayerStatus | undefined;
  const selected: PrayerStatus = requested && statuses.includes(requested) ? requested : "ACTIVE";
  const [items, setItems] = useState<Prayer[]>([]);
  const [all, setAll] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [nextItems, nextAll] = await Promise.all([repository.listByStatus(selected), repository.listActive()]);
    setItems(nextItems);
    setAll(nextAll);
    setLoading(false);
  }, [selected]);
  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => Object.fromEntries(statuses.map((status) => [status, all.filter((item) => item.status === status).length])) as Record<PrayerStatus, number>, [all]);

  return (
    <main className="visual-screen prayer-screen live-prayer-screen">
      <header className="screen-heading compact-heading prayer-main-heading">
        <p className="eyebrow">Prayer</p>
        <h1>Prayer</h1>
        <p className="screen-intro">Keep requests, updates and answers together. The list supports prayer; it is not a task inbox to clear.</p>
        <div className="prayer-primary-actions">
          <Link className="primary-editorial-action compact-action" to="/prayer/new">Add prayer <Icon name="arrow" /></Link>
          {counts.ACTIVE > 0 ? <Link className="prayer-now-link" to="/prayer/session?depth=quick">Pray now</Link> : null}
        </div>
      </header>

      {counts.ACTIVE > 0 ? (
        <section className="prayer-session-choices" aria-label="Focused prayer depth">
          <p className="section-kicker">Focused prayer</p>
          <div><Link to="/prayer/session?depth=quick"><strong>Quick</strong><span>up to 4 requests</span></Link><Link to="/prayer/session?depth=regular"><strong>Regular</strong><span>up to 10 requests</span></Link><Link to="/prayer/session?depth=extended"><strong>Extended</strong><span>up to 20 requests</span></Link></div>
        </section>
      ) : null}

      <nav className="prayer-status-tabs" aria-label="Prayer status">
        {statuses.map((status) => <Link key={status} className={selected === status ? "is-active" : ""} to={`/prayer?status=${status}`}><span>{labels[status]}</span><small>{counts[status]}</small></Link>)}
      </nav>

      <section className="prayer-live-list" aria-live="polite">
        {loading ? <p className="muted-copy">Opening prayers…</p> : items.length === 0 ? (
          <div className="prayer-empty"><h2>No {labels[selected].toLowerCase()} prayers.</h2><p>{selected === "ACTIVE" ? "Add a request when there is something you genuinely want to carry into prayer." : "Nothing needs to be here."}</p>{selected === "ACTIVE" ? <Link to="/prayer/new">Add prayer →</Link> : null}</div>
        ) : items.map((prayer) => (
          <Link className="prayer-live-row" to={`/prayer/${prayer.id}`} key={prayer.id}>
            <div><span className={`prayer-status-word status-${prayer.status.toLowerCase()}`}>{labels[prayer.status]}</span><p>{prayer.body}</p><small>{lastPrayedLabel(prayer)}</small></div><Icon name="arrow" />
          </Link>
        ))}
      </section>
    </main>
  );
}
