import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DevotionalIcon } from '../app/visual/DevotionalIcon';
import { db } from '../data/database';
import { PrayerSessionRepository } from '../data/repositories/prayer-sessions';
import { PrayerRepository } from '../data/repositories/prayers';
import { useLocalClock } from '../app/useLocalClock';
import type { PrayerSession } from '../domain/types';
const repository = new PrayerRepository(db);
const sessions = new PrayerSessionRepository(db);
export function TodayPrayerPanel() {
  const { localDate: today } = useLocalClock();
  const [error, setError] = useState(false);
  const [count, setCount] = useState(0);
  const [openSession, setOpenSession] = useState<PrayerSession | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([repository.listByStatus('ACTIVE'), sessions.getOpenSession()]).then(([items, session]) => {
      if (!cancelled) { setCount(items.length); setOpenSession(session?.localDate === today ? session : null); setError(false); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [today]);
  const href = error ? '/prayer' : openSession ? `/prayer/session?depth=${openSession.depth}` : count ? '/prayer/session?depth=quick' : '/prayer/new';
  return <Link className="today-response grace-paper today-response--prayer" to={href} aria-label={error ? 'Pray — Open Prayer' : openSession ? 'Pray — Resume session' : count ? 'Pray — Begin quietly' : 'Pray — Add prayer'}>
    <span className="grace-icon-circle grace-icon-circle--prayer"><DevotionalIcon name="prayer" /></span>
    <h2>Pray</h2>
    <p>{error ? 'Open Prayer to try again.' : openSession ? 'Continue your quiet time with God.' : 'Bring your heart to God.'}</p>
    <DevotionalIcon name="chevron" className="today-response-arrow" />
  </Link>;
}
