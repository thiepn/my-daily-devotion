import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../app/visual/Icon";
import { db } from "../data/database";
import { PrayerSessionRepository } from "../data/repositories/prayer-sessions";
import { PrayerRepository } from "../data/repositories/prayers";
import { useLocalClock } from "../app/useLocalClock";
import type { PrayerSession } from "../domain/types";
const repository = new PrayerRepository(db); const sessions = new PrayerSessionRepository(db);
export function TodayPrayerPanel() {
  const { localDate: today } = useLocalClock();
  const [error, setError] = useState("");
  const [count, setCount] = useState(0); const [openSession, setOpenSession] = useState<PrayerSession | null>(null);
  useEffect(() => { let cancelled = false; Promise.all([repository.listByStatus("ACTIVE"), sessions.getOpenSession()]).then(([items, session]) => { if (!cancelled) { setCount(items.length); setOpenSession(session?.localDate === today ? session : null); } }).catch(() => { if (!cancelled) setError("Could not refresh prayer details. Open Prayer to try again."); }); return () => { cancelled = true; }; }, [today]);
  return <section className="editorial-section prayer-preview today-prayer-panel" aria-labelledby="today-prayer-heading">{error ? <p role="alert">{error}</p> : null}<p className="section-kicker mg-panel-kicker"><Icon name="prayer" aria-hidden="true" /> Pray</p><h2 id="today-prayer-heading">{openSession ? "Continue praying" : count ? "Pray now" : "Prayer stays close."}</h2>{openSession ? <><p className="muted-copy">Your unfinished {openSession.depth} session is preserved exactly where it belongs.</p><div className="today-prayer-actions"><Link className="future-text-link" to={`/prayer/session?depth=${openSession.depth}`}>Resume session →</Link><Link to="/prayer">Prayer list</Link></div></> : count ? <><p className="muted-copy">Focus, event, and due requests surface first; then new and least-recently-prayed requests.</p><div className="prayer-count-line"><strong>{count}</strong><span>active {count === 1 ? "request" : "requests"}</span></div><div className="today-prayer-actions"><Link className="future-text-link" to="/prayer/session?depth=quick">Begin quietly →</Link><Link to="/prayer/new">Add prayer</Link></div></> : <><p className="muted-copy">Capture a request when there is something you actually want to remember and pray for.</p><Link className="future-text-link" to="/prayer/new">Add prayer →</Link></>}</section>;
}
