import { useEffect, useRef, useState, type FormEvent } from "react";
import { BACKUP_TABLE_LABELS } from "./data-context";
import type { BackupContentCount, RestoreReview } from "./portability";

export function formatBackupDate(value: string) { return new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
export function PasswordForm({ id, busy, submit, cancel }: { id: string; busy: boolean; submit: (password: string) => Promise<boolean>; cancel: () => void }) {
  const [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [visible, setVisible] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { form.current?.focus({ preventScroll: true }); }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current || busy) return;
    if (password.length < 8) { setError("Use a password of at least 8 characters."); return; }
    if (password !== confirmation) { setError("The passwords do not match. Please check both fields."); return; }
    lock.current = true; setError("");
    try { if (await submit(password)) { setPassword(""); setConfirmation(""); } } finally { lock.current = false; }
  };
  return <form ref={form} tabIndex={-1} aria-label="Protect your backup" className="backup-password-form" onSubmit={event => void save(event)}>
    <label htmlFor={`${id}-password`}>Encrypted backup password</label><input id={`${id}-password`} type={visible ? "text" : "password"} value={password} autoComplete="new-password" disabled={busy} onChange={e => { setPassword(e.target.value); setError(""); }} aria-describedby={`${id}-help`} />
    <label htmlFor={`${id}-confirm`}>Confirm password</label><input id={`${id}-confirm`} type={visible ? "text" : "password"} value={confirmation} autoComplete="new-password" disabled={busy} onChange={e => { setConfirmation(e.target.value); setError(""); }} />
    <button className="password-visibility" type="button" aria-pressed={visible} disabled={busy} onClick={() => setVisible(value => !value)}>{visible ? "Hide passwords" : "Show passwords"}</button>
    <p className="data-help" id={`${id}-help`}>At least 8 characters. Keep your password somewhere safe: a forgotten password cannot be recovered.</p>
    {error ? <p className="data-error" role="alert">{error}</p> : null}
    <div className="journal-actions"><button className="grace-primary" type="submit" disabled={busy || password.length < 8 || !confirmation}>{busy ? "Preparing backup…" : "Download encrypted backup"}</button><button type="button" disabled={busy} onClick={cancel}>Cancel</button></div>
  </form>;
}

export function BackupRecordCounts({ contents }: { contents: Readonly<Record<string, BackupContentCount>> }) {
  return <>
    <dl className="backup-counts">{["reflections", "prayers", "highlights", "verseNotes", "readingProgress", "activityEvents"].map(key => <div key={key}><dt>{BACKUP_TABLE_LABELS[key]}</dt><dd>{contents[key]?.live ?? 0}</dd></div>)}</dl>
    <p className="data-help">Counts above exclude each record’s deletion marker. Related records may be unavailable when their parent was removed.</p>
    <details className="data-inner-disclosure"><summary>All records & deletion markers</summary><dl className="backup-full-counts">{Object.entries(contents).map(([key, count]) => <div key={key}><dt>{BACKUP_TABLE_LABELS[key] ?? key}</dt><dd>{count.live} saved · {count.deletionMarkers} removed</dd></div>)}</dl><p className="data-help">Removed records retain deletion markers and may retain text. Backups preserve these records so removals can be carried between copies.</p></details>
  </>;
}
export function RestoreContents({ review }: { review: RestoreReview }) {
  return <>
    <BackupRecordCounts contents={review.contents} />
    {review.recovery ? <div className="recovery-backup-counts"><h3>Private recovery contents</h3><dl className="backup-full-counts">{[["Active unfinished drafts", review.recovery.activeDrafts], ["Previous-journal or committed drafts", review.recovery.copyOnlyDrafts], ["Previous saved versions", review.recovery.priorVersions], ["Originally eligible removal groups", review.recovery.eligibleRemovals], ["Expired or previous-journal removal groups", review.recovery.expiredRemovals]].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}</dl><p className="data-help">Private recovery entries are imported as previous-journal copies. They are not reapplied to saved records, and thirty-day restoration windows are not extended.</p></div> : null}
    <h3>What will change</h3><dl className="restore-effects">{[["Added", review.effects.additions], ["Replaced", review.effects.replacements], ["Kept locally", review.effects.retained], ["Removed from this browser", review.effects.removals]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    <p className="data-help">These are database records, including links, settings and History. {review.effects.newlyRemoved} saved records become marked removed; {review.effects.restored} removed records become available again.</p>
    <details className="data-inner-disclosure"><summary>Changes by record type</summary><dl className="backup-full-counts">{Object.entries(review.tables).filter(([, effect]) => effect.additions + effect.replacements + effect.retained + effect.removals > 0).map(([key, effect]) => <div key={key}><dt>{BACKUP_TABLE_LABELS[key]}</dt><dd>{effect.additions} added · {effect.replacements} replaced · {effect.retained} kept · {effect.removals} removed</dd></div>)}</dl></details>
    {review.equalRevisionDifferences.length ? <details className="data-inner-disclosure restore-differences"><summary>{review.equalRevisionDifferences.length} differing records share the same revision</summary><p>{review.mode === "merge" ? "Merge keeps your local versions of these records." : "Replace uses the backup versions of these records."} This restore does not combine their writing.</p><ul>{review.equalRevisionDifferences.map(item => <li key={item.table + item.key}>{BACKUP_TABLE_LABELS[item.table]} · <code>{item.key}</code></li>)}</ul></details> : null}
  </>;
}
