import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { JournalHeading } from '../writing/JournalPrimitives';
import { db } from './database';
import { safeDataReturn } from './data-context';
import { BackupRecordCounts, formatBackupDate } from './BackupControls';
import { checkMddBackup, inspectMddBackup, type ValidatedBackupContents } from './portability';

export function BackupCheckScreen() {
  const [params] = useSearchParams();
  const origin = params.get('return');
  const returnTo = origin && /^\/data(?:\?|$)/.test(origin) && !/[\\\x00-\x1f]/.test(origin) ? origin : origin ? safeDataReturn(origin) : '/data';
  const [filename, setFilename] = useState(''), [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [password, setPassword] = useState(''), [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [result, setResult] = useState<ValidatedBackupContents | null>(null);
  const bytes = useRef<Uint8Array | null>(null), input = useRef<HTMLInputElement>(null);
  const generation = useRef(0), pending = useRef<number | null>(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; bytes.current?.fill(0); bytes.current = null; }; }, []);
  const clear = () => {
    generation.current++; pending.current = null; bytes.current?.fill(0); bytes.current = null;
    setFilename(''); setPassword(''); setVisible(false); setEncrypted(null); setResult(null); setStatus(''); setError(''); setBusy(false);
    if (input.current) input.current.value = '';
  };
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; clear(); if (!file) return;
    const version = generation.current; pending.current = version; setBusy(true); setFilename(file.name); setStatus('Reading the file…');
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('This backup exceeds the supported 64 MB file size.');
      const value = new Uint8Array(await file.arrayBuffer());
      if (!alive.current || version !== generation.current) { value.fill(0); return; }
      const header = inspectMddBackup(value); bytes.current = value; setEncrypted(header.encrypted);
      setStatus('File selected. Its contents have not yet been validated.');
    } catch (reason) { if (alive.current && version === generation.current) { setError(reason instanceof Error ? reason.message : 'Could not read this backup.'); setStatus(''); } }
    finally { if (pending.current === version) { pending.current = null; if (alive.current) setBusy(false); } }
  };
  const check = async (event: FormEvent) => {
    event.preventDefault(); if (pending.current !== null || !bytes.current) return;
    const version = generation.current; pending.current = version; setBusy(true); setError(''); setResult(null); setStatus('Checking encryption, checksums, records and relationships…');
    try {
      const checked = await checkMddBackup(bytes.current, password, db);
      if (!alive.current || version !== generation.current) return;
      setResult(checked); setPassword(''); bytes.current?.fill(0); bytes.current = null;
      if (input.current) input.current.value = '';
      setStatus('Backup validated. Your current journal has not changed.');
    } catch (reason) { if (alive.current && version === generation.current) { setError(reason instanceof Error ? reason.message : 'Could not validate this backup.'); setStatus(''); } }
    finally { if (pending.current === version) { pending.current = null; if (alive.current) setBusy(false); } }
  };
  return <main className="journal-workspace data-journal backup-check-screen">
    <JournalHeading title="Check a backup" subtitle="A little reassurance" back={returnTo} />
    <p className="data-opening">Open a saved backup and check its contents without restoring it. Nothing is uploaded or changed in your journal.</p>
    <section className="data-panel journal-paper" aria-label="Check your backup">
      <label htmlFor="check-backup-file">Backup file<input id="check-backup-file" ref={input} type="file" accept=".mddbackup" disabled={busy} onChange={event => void choose(event)} /></label>
      {filename && <p className="backup-check-filename">{filename}</p>}
      {!result && encrypted !== null && <form onSubmit={event => void check(event)}>
        {encrypted && <><label htmlFor="check-backup-password">Backup password<input id="check-backup-password" type={visible ? 'text' : 'password'} autoComplete="off" disabled={busy} value={password} onChange={event => { generation.current++; setPassword(event.target.value); setError(''); }} /></label><button className="password-visibility" type="button" disabled={busy} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? 'Hide password' : 'Show password'}</button></>}
        <div className="journal-actions"><button type="submit" className="grace-primary" disabled={busy || Boolean(encrypted && !password)}>{busy ? 'Checking…' : 'Validate this backup'}</button></div>
      </form>}
      {status && <p className="data-status" role="status">{status}</p>}{error && <p className="data-error" role="alert">{error}</p>}
      {result && <><h2>What this file contains</h2><p>{formatBackupDate(result.manifest.exportedAt)} · {result.encrypted ? 'Encrypted' : 'Plain'} backup</p><BackupRecordCounts contents={result.contents} />{result.recovery ? <div className="recovery-backup-counts"><h3>Private recovery data</h3><p>{result.recovery.activeDrafts} active drafts · {result.recovery.copyOnlyDrafts} previous writing copies · {result.recovery.priorVersions} saved versions · {result.recovery.eligibleRemovals} eligible and {result.recovery.expiredRemovals} expired or previous-journal removal groups at export.</p><p className="data-help">This report excludes the private writing itself. Format-2 recovery data never replays an unfinished action on import.</p></div> : null}<p className="data-help">These counts describe this file; they do not show whether you still have other backups elsewhere.</p></>}
      {filename && <button className="data-secondary-action" onClick={clear}>{result ? 'Check another backup' : 'Cancel check'}</button>}
    </section>
  </main>;
}
