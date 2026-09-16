import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";

const repository = new PrayerRepository(db);

export function TodayPrayerPanel() {
  const [count, setCount] = useState(0);
  useEffect(() => { let cancelled = false; repository.listByStatus("ACTIVE").then((items) => { if (!cancelled) setCount(items.length); }); return () => { cancelled = true; }; }, []);
  return (
    <section className="editorial-section prayer-preview today-prayer-panel" aria-labelledby="today-prayer-heading">
      <p className="section-kicker">Pray</p><h2 id="today-prayer-heading">{count ? "Pray now" : "Prayer stays close."}</h2>
      {count ? <><p className="muted-copy">Active requests surface by least-recently-prayed order, not urgency scores.</p><div className="prayer-count-line"><strong>{count}</strong><span>active {count === 1 ? "request" : "requests"}</span></div><div className="today-prayer-actions"><Link className="future-text-link" to="/prayer/session?depth=quick">Begin quietly →</Link><Link to="/prayer/new">Add prayer</Link></div></> : <><p className="muted-copy">Capture a request when there is something you actually want to remember and pray for.</p><Link className="future-text-link" to="/prayer/new">Add prayer →</Link></>}
    </section>
  );
}
