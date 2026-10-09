import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DevotionalIcon } from '../app/visual/DevotionalIcon';
import { db } from '../data/database';
import { ReflectionRepository } from '../data/repositories/reflections';
import type { LocalDate, Reflection } from '../domain/types';
import { buildReflectionUrl } from './context';
const repository = new ReflectionRepository(db);
export function TodayReflectionPanel({ localDate }: { localDate: LocalDate }) {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    repository.getDaily(localDate).then(value => { if (!cancelled) { setReflection(value ?? null); setFailed(false); } }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [localDate]);
  return <Link className="today-response grace-paper" to={buildReflectionUrl(localDate)} aria-label={reflection ? 'Reflect — Continue reflection' : 'Reflect — Write reflection'}>
    <span className="grace-icon-circle"><DevotionalIcon name="bible" /></span>
    <h2>Reflect</h2>
    <p>{failed ? 'Open your reflection to try again.' : reflection ? 'Return to the words you’ve gathered today.' : 'What is the Lord speaking to you today?'}</p>
    <DevotionalIcon name="chevron" className="today-response-arrow" />
  </Link>;
}
