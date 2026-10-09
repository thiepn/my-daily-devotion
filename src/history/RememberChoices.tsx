import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocalClock } from '../app/useLocalClock';
import { readBackupReceipt } from '../data/backup-receipt';
import { REMEMBER_CHANGED, backupReminderDue, nextReminderMonth, readRememberPreferences, updateRememberPreferences, type RememberPreferences } from './remember-preferences';
import { useHistoryLoad } from './hooks';
import { loadAnniversaries } from './remember';
import { db } from '../data/database';
import { withHistoryReturn } from './journal';

export function useRememberChoices() {
  const [state, setState] = useState(readRememberPreferences);
  const refresh = () => setState(readRememberPreferences());
  useEffect(() => {
    window.addEventListener('storage', refresh); window.addEventListener('focus', refresh); window.addEventListener(REMEMBER_CHANGED, refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); }; document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh); window.removeEventListener(REMEMBER_CHANGED, refresh); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return { state, refresh };
}
export function RememberChoices() {
  const { state, refresh } = useRememberChoices(), { localDate } = useLocalClock();
  const [message, setMessage] = useState(''), [failed, setFailed] = useState(false);
  const save = (change: (current: RememberPreferences) => RememberPreferences) => {
    const result = updateRememberPreferences(change); setFailed(result.status === 'unavailable');
    setMessage(result.status === 'unavailable' ? 'Could not save these choices. They are not protected; please retry.' : 'Choices saved in this browser.'); refresh();
  };
  return <section className="remember-choices" aria-label="Optional remembering and protection"><h3>Your choices</h3><p>These optional suggestions stay in this browser and start off. They do not change historical activity, enable notifications or measure your devotion.</p>
    {state.status === 'unavailable' ? <p role="alert">This browser’s saved choices are unavailable.<button onClick={refresh}>Retry choices</button></p> : <>
      <h4>On this day</h4><p>Offer past reflections, answers, encouragement and highlights recorded on this same month and day. Missing anniversaries are omitted.</p>
      <button onClick={() => save(current => ({ ...current, anniversaries: !current.anniversaries }))}>{state.value.anniversaries ? 'Turn off On this day' : 'Enable On this day'}</button>
      <h4>Backup reminders</h4><p>A monthly in-app reminder to keep an independent copy. The browser knows when it generated a backup, not where you retained it.</p>
      <button onClick={() => save(current => ({ ...current, backupReminder: current.backupReminder ? null : { next: nextReminderMonth(localDate) } }))}>{state.value.backupReminder ? 'Turn off backup reminders' : 'Enable monthly backup reminders'}</button>
      {state.value.backupReminder && <p>Next reminder no earlier than {state.value.backupReminder.next}; generating a backup postpones it another month.</p>}
    </>}{message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </section>;
}
export function RememberSuggestions({ url }: { url: string }) {
  const { state, refresh } = useRememberChoices(), { localDate } = useLocalClock(), [error, setError] = useState('');
  const value = state.value, enabled = Boolean(value?.anniversaries && !value.dismissedDates.includes(localDate));
  const result = useHistoryLoad(`anniversary|${localDate}|${enabled}`, () => enabled ? loadAnniversaries(db, localDate, 5) : Promise.resolve(null));
  const due = Boolean(value && backupReminderDue(value, readBackupReceipt(), localDate));
  const dismiss = (backup: boolean) => {
    const saved = updateRememberPreferences(current => backup ? { ...current, backupReminder: { next: nextReminderMonth(localDate) } } : { ...current, dismissedDates: [...new Set([...current.dismissedDates, localDate])].slice(-60) });
    setError(saved.status === 'unavailable' ? 'Could not save the dismissal. Please retry.' : ''); refresh();
  };
  if (!due && !result.data?.entries.length && !error) return null;
  return <aside className="remember-suggestions" aria-label="Optional suggestions">
    {result.data?.entries.length ? <section className="grace-paper"><h2>On this day</h2><p>A few words from earlier years, when you would like to revisit them.</p><div className="journal-actions"><Link id="remember-anniversary" to={withHistoryReturn('/history/on-this-day', url)}>Revisit these moments</Link><button onClick={() => dismiss(false)}>Dismiss for today</button></div></section> : null}
    {due && <section className="grace-paper"><h2>Keep a separate copy</h2><p>Your optional monthly reminder. You may already have a backup elsewhere; this browser cannot verify that.</p><div className="journal-actions"><Link id="remember-backup" to={withHistoryReturn('/data?section=backups', url)}>Open backups</Link><button onClick={() => dismiss(true)}>Remind me next month</button></div></section>}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
