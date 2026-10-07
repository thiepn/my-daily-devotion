import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useBlocker, useLocation, useNavigate } from "react-router-dom";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { inspectStorage, type StorageSnapshot } from "../app/platform";
import { useUpdateProtection } from "../app/useUpdateProtection";
import { APP_VERSION } from "../app/version";
import { refreshThemePreferences, ThemeSwitcher } from "../app/visual/ThemeSwitcher";
import { JournalDialog, JournalHeading } from "../writing/JournalPrimitives";
import { db } from "./database";
import { DATABASE_SCHEMA_VERSION } from "./schema";
import { parseDataContext } from "./data-context";
import { readBackupReceipt, recordBackupReceipt } from "./backup-receipt";
import { clearDataReturnPosition } from "./useDataReturnPosition";
import { PasswordForm, RestoreContents, formatBackupDate } from "./BackupControls";
import { commitMddRestore, createMarkdownArchive, discardMddRestore, generateMddBackup, inspectMddBackup, prepareMddRestore, StaleRestoreReviewError, type CommittedRestoreResult, type ImportMode, type RestoreReview } from "./portability";

function download(bytes: Uint8Array, name: string, type = "application/octet-stream") {
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  // The browser owns the download; it cannot confirm where the user retains it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function focusControl(id: string) { requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true })); }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "Could not complete this step. Please try again."; }
function formatBytes(value: number | null): string { if (value === null) return "Unavailable"; if (value < 1024) return `${value} B`; const units = ["KB", "MB", "GB", "TB"]; let next = value / 1024; let unit = units[0]!; for (let index = 1; next >= 1024 && index < units.length; index += 1) { next /= 1024; unit = units[index]!; } return `${next >= 10 ? next.toFixed(0) : next.toFixed(1)} ${unit}`; }

export function DataScreen() {
  const location = useLocation(), navigate = useNavigate(), context = parseDataContext(location.search);
  const [exportForm, setExportForm] = useState(false), [receipt, setReceipt] = useState(readBackupReceipt);
  const [exportStatus, setExportStatus] = useState(""), [exportError, setExportError] = useState("");
  const [filename, setFilename] = useState(""), [encrypted, setEncrypted] = useState<boolean | null>(null), [importPassword, setImportPassword] = useState(""), [showPassword, setShowPassword] = useState(false);
  const bytes = useRef<Uint8Array | null>(null), reviewRef = useRef<RestoreReview | null>(null), input = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<RestoreReview | null>(null), [mode, setMode] = useState<ImportMode>("merge"), [restoreStatus, setRestoreStatus] = useState(""), [restoreError, setRestoreError] = useState("");
  const [safeguard, setSafeguard] = useState<"none" | "offer" | "backup" | "ready">("none"), [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<CommittedRestoreResult | null>(null), [refreshError, setRefreshError] = useState("");
  const [operation, setOperation] = useState<"export" | "read" | "validate" | "commit" | "refresh" | null>(null);
  const lock = useRef(false), generation = useRef(0), alive = useRef(true), committing = useRef(false);
  useUpdateProtection(operation === "commit");
  const [storage, setStorage] = useState<StorageSnapshot | null>(null), [storageError, setStorageError] = useState(false);
  const busy = operation !== null;
  const blocker = useBlocker(() => committing.current);
  const clearReview = () => { if (reviewRef.current) discardMddRestore(reviewRef.current); reviewRef.current = null; setReview(null); setConfirm(false); setSafeguard("none"); };
  const invalidate = () => { generation.current++; clearReview(); setRestoreError(""); setRestoreStatus(""); setResult(null); setRefreshError(""); };
  const clearFile = (resetInput = true) => { bytes.current?.fill(0); bytes.current = null; setFilename(""); setEncrypted(null); setImportPassword(""); setShowPassword(false); if (resetInput && input.current) input.current.value = ""; };
  const cancel = () => { if (committing.current) return; invalidate(); clearFile(); setRestoreStatus("Restore cancelled. Your data has not changed."); };
  const refreshStorage = async (persist = false) => { try { const value = await inspectStorage(persist); if (alive.current) { setStorage(value); setStorageError(false); } } catch { if (alive.current) setStorageError(true); } };
  useEffect(() => {
    alive.current = true; void refreshStorage();
    const warn = (event: BeforeUnloadEvent) => { if (committing.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { alive.current = false; generation.current++; bytes.current?.fill(0); bytes.current = null; if (reviewRef.current) discardMddRestore(reviewRef.current); reviewRef.current = null; window.removeEventListener("beforeunload", warn); };
  }, []);
  useEffect(() => { if (blocker.state === "blocked" && !committing.current) blocker.reset(); }, [blocker, operation]);
  useEffect(() => { if (location.search !== context.search) navigate({ pathname: "/data", search: context.search }, { replace: true }); }, [location.search, context.search, navigate]);
  useEffect(() => {
    if (!context.section) return;
    const element = document.getElementById(`data-${context.section}`);
    if (element instanceof HTMLDetailsElement) element.open = true;
    const frame = requestAnimationFrame(() => { element?.scrollIntoView({ block: "start", behavior: "instant" }); (element?.querySelector<HTMLElement>("summary, h2") ?? element)?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [context.section]);

  const exportBackup = async (password?: string, forReplacement = false): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true; setOperation("export"); setExportError(""); setExportStatus("Preparing backup…"); const version = generation.current;
    try {
      const generated = await generateMddBackup(db, APP_VERSION, password);
      if (!alive.current || version !== generation.current) return false;
      setReceipt(recordBackupReceipt(generated));
      download(generated.bytes, `mdd-${generated.generatedAt.slice(0, 10)}${generated.kind === "encrypted" ? "-encrypted" : ""}.mddbackup`);
      setExportStatus("Download requested. Keep the file somewhere safe outside this browser."); setExportForm(false);
      if (forReplacement) { setSafeguard("ready"); setRestoreStatus("Current backup download requested. Check that you have the file before continuing."); }
      focusControl(forReplacement ? "restore-continue" : "create-backup");
      return true;
    } catch (reason) { if (alive.current && version === generation.current) { setExportError(message(reason)); setExportStatus(""); } return false; }
    finally { lock.current = false; if (alive.current) setOperation(null); }
  };
  const exportMarkdown = async () => {
    if (lock.current) return;
    lock.current = true; setOperation("export"); setExportError(""); setExportStatus("Preparing Markdown archive…"); const version = generation.current;
    try { const archive = await createMarkdownArchive(db); if (alive.current && version === generation.current) { download(archive, `mdd-markdown-${new Date().toISOString().slice(0, 10)}.zip`, "application/zip"); setExportStatus("Download requested. This Markdown archive is unencrypted."); } }
    catch (reason) { if (alive.current && version === generation.current) { setExportError(message(reason)); setExportStatus(""); } }
    finally { lock.current = false; if (alive.current) setOperation(null); }
  };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (committing.current) return;
    const file = event.target.files?.[0]; invalidate(); clearFile(false); if (!file) { setOperation(null); return; }
    const version = generation.current; setFilename(file.name); setOperation("read");
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error("This backup exceeds the supported 64 MB file size.");
      const value = new Uint8Array(await file.arrayBuffer());
      if (!alive.current || version !== generation.current) { value.fill(0); return; }
      const header = inspectMddBackup(value); bytes.current = value; setEncrypted(header.encrypted);
      setRestoreStatus("File selected. Its contents have not yet been validated.");
    } catch (reason) { if (alive.current && version === generation.current) setRestoreError(message(reason)); }
    finally { if (alive.current && version === generation.current) setOperation(null); }
  };
  const validate = async () => {
    if (lock.current || !bytes.current) return;
    lock.current = true; setOperation("validate"); clearReview(); setRestoreError(""); setRestoreStatus("Validating your backup and reviewing local data…"); const version = generation.current;
    try {
      const prepared = await prepareMddRestore(bytes.current, importPassword, mode, db);
      if (!alive.current || version !== generation.current) { discardMddRestore(prepared); return; }
      reviewRef.current = prepared; setReview(prepared); setRestoreStatus("Backup validated. No current data has been changed.");
    } catch (reason) { if (alive.current && version === generation.current) { setRestoreError(message(reason)); setRestoreStatus(""); } }
    finally { lock.current = false; if (alive.current) setOperation(current => current === "validate" ? null : current); }
  };
  const refreshRestored = async () => {
    try { await refreshThemePreferences(); if (alive.current) { setRefreshError(""); void refreshStorage(); } }
    catch { if (alive.current) setRefreshError("Your backup was restored, but appearance could not be refreshed. Retry refresh without restoring again."); }
  };
  const commit = async () => {
    if (lock.current || !reviewRef.current) return;
    lock.current = true; committing.current = true; setOperation("commit"); setRestoreError("");
    try {
      const committed = await commitMddRestore(reviewRef.current, db);
      clearDataReturnPosition(); clearReview(); clearFile(); setExportForm(false); setResult(committed);
      setRestoreStatus(`Backup ${committed.mode === "merge" ? "merged" : "restored"} successfully. Your saved records are now available on this device.`);
      await refreshRestored();
    } catch (reason) { setConfirm(false); setRestoreStatus(""); setRestoreError(message(reason)); if (reason instanceof StaleRestoreReviewError) clearReview(); }
    finally { committing.current = false; lock.current = false; if (alive.current) setOperation(null); }
  };
  const continueRestore = () => { if (!review || busy) return; if (review.mode === "replace" && review.hasLocalDevotionalRecords && safeguard !== "ready") setSafeguard("offer"); else setConfirm(true); };

  return <main className="journal-workspace data-journal data-screen">
    <JournalHeading title="Your data" subtitle="Keep what matters" back={context.returnTo} />
    <p className="data-opening">A little care for the words, prayers and moments you’ve kept.</p>
    <section className="data-panel journal-paper backup-panel" id="data-backups" aria-labelledby="backups-title">
      <div className="data-section-heading"><span className="data-symbol"><LockKeyIcon weight="light" aria-hidden="true" /></span><div><p className="journal-kicker">Safe keeping</p><h2 id="backups-title" tabIndex={-1}>Backups</h2></div></div>
      <p>Keep a copy of your whole devotional journal. An encrypted backup protects the file with a password.</p>
      {!exportForm ? <button id="create-backup" className="grace-primary data-main-action" disabled={busy} onClick={() => { setExportForm(true); setExportStatus(""); setExportError(""); }}>Create encrypted backup</button> : <PasswordForm id="export" busy={busy} submit={password => exportBackup(password)} cancel={() => { setExportForm(false); focusControl("create-backup"); }} />}
      <p className="data-help">Your journal stays in this browser. A backup gives you a separate copy if you change devices or browser storage is cleared.</p>
      <div className="backup-receipt"><strong>Last backup generated in this browser</strong><p>{receipt.receipt ? `${formatBackupDate(receipt.receipt.generatedAt)} · ${receipt.receipt.kind === "encrypted" ? "Encrypted" : "Plain"}` : receipt.status === "unavailable" ? "This browser’s backup receipt is unavailable." : "No backup receipt is available in this browser."}</p><span>{receipt.receipt ? "This records generation, not whether the file was retained." : "You may still have a backup saved elsewhere."}</span></div>
      <details className="data-inner-disclosure"><summary>Other export options</summary><p>These files are <strong>unencrypted</strong>. Anyone with the file can read its contents, including retained removed records.</p><button className="data-secondary-action" disabled={busy} onClick={() => void exportBackup()}>Download plain backup</button><p>A complete <code>.mddbackup</code> file for restoring in MDD.</p><button className="data-secondary-action" disabled={busy} onClick={() => void exportMarkdown()}>Download Markdown archive</button><p>Readable writing plus a complete <code>data.json</code> containing retained records. This archive is not a <code>.mddbackup</code> restore file.</p></details>
      <details className="data-inner-disclosure"><summary>Move to another device</summary><ol><li>Create an encrypted backup here.</li><li>Transfer the file using a method you choose. Keep its password safe.</li><li>Open My Daily Devotion on the destination device.</li><li>Choose Restore, select the file, and review it before confirming.</li></ol><p>MDD does not upload your backup or provide a transfer service.</p></details>
      {exportStatus ? <p className="data-status" role="status">{exportStatus}</p> : null}{exportError ? <p className="data-error" role="alert">{exportError}</p> : null}
    </section>
    <section className="data-panel journal-paper restore-panel" id="data-restore" aria-labelledby="restore-title">
      <div className="data-section-heading"><span className="data-symbol data-symbol--clay"><ArrowCounterClockwiseIcon weight="light" aria-hidden="true" /></span><div><p className="journal-kicker">Welcome it back</p><h2 id="restore-title" tabIndex={-1}>Restore</h2></div></div>
      <ol className="restore-steps" aria-label="Restore steps">{["Choose file", "Review", "Confirm", "Result"].map((label, index) => <li key={label} aria-current={(result ? 3 : confirm || safeguard !== "none" ? 2 : review ? 1 : 0) === index ? "step" : undefined}>{label}</li>)}</ol>
      {!result ? <>
        <p>Open a saved <code>.mddbackup</code> file. Nothing changes until you review and confirm.</p>
        <label className="data-file-label" htmlFor="backup-file">Backup file</label><input ref={input} id="backup-file" type="file" accept=".mddbackup,application/zip" disabled={operation === "commit" || operation === "export"} onChange={event => void chooseFile(event)} />
        {filename ? <p className="data-filename">{filename}</p> : null}
        {encrypted ? <div className="backup-password-form"><label htmlFor="restore-password">Backup password</label><input id="restore-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={importPassword} disabled={operation === "commit"} onChange={event => { invalidate(); setImportPassword(event.target.value); }} /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={operation === "commit"}>{showPassword ? "Hide password" : "Show password"}</button></div> : null}
        {encrypted !== null ? <fieldset className="import-mode"><legend>Restore mode</legend><label><input type="radio" name="restore-mode" value="merge" checked={mode === "merge"} disabled={operation === "commit"} onChange={() => { invalidate(); setMode("merge"); }} /><span><strong>Merge</strong><small>Add missing records. Higher revisions may replace local versions; equal revisions keep the local version. Preferences use their saved date.</small></span></label><label><input type="radio" name="restore-mode" value="replace" checked={mode === "replace"} disabled={operation === "commit"} onChange={() => { invalidate(); setMode("replace"); }} /><span><strong>Replace</strong><small>Use the backup’s records and preferences. Local-only records will be removed from this browser.</small></span></label></fieldset> : null}
        {!review ? <button className="data-secondary-action" disabled={busy || encrypted === null || (encrypted && !importPassword)} onClick={() => void validate()}>{operation === "validate" ? "Validating…" : "Preview & validate"}</button> : <div className="backup-preview">
          <p className="backup-validated">Validated {review.encrypted ? "encrypted" : "plain"} backup</p><p className="data-help">Exported {formatBackupDate(review.manifest.exportedAt)}</p><RestoreContents review={review} />
          {safeguard === "offer" || safeguard === "backup" ? <div className="replace-safeguard"><h3>Keep a copy before replacing?</h3><p>Your current journal includes saved records. Create a backup now, or explicitly skip this step.</p>{safeguard === "offer" ? <div className="journal-actions"><button id="safeguard-backup" className="grace-primary" disabled={busy} onClick={() => setSafeguard("backup")}>Back up current data</button><button disabled={busy} onClick={() => { setSafeguard("ready"); setConfirm(true); }}>Skip backup</button></div> : <><PasswordForm id="safeguard" busy={busy} submit={password => exportBackup(password, true)} cancel={() => { setSafeguard("offer"); focusControl("safeguard-backup"); }} />{exportError ? <p role="alert">{exportError}</p> : null}</>}</div> : <div className="journal-actions"><button id="restore-continue" className="grace-primary" disabled={busy} onClick={continueRestore}>Continue to confirmation</button></div>}
        </div>}
        {filename ? <button className="cancel-restore" disabled={operation === "commit"} onClick={cancel}>Cancel restore</button> : null}
      </> : <div className="restore-result"><h3>Your journal is here.</h3><p>The restore has been committed. No new devotional activity was created.</p><Link className="data-secondary-action" to="/today">Return to Today</Link><button onClick={() => { invalidate(); clearFile(); }}>Restore another backup</button></div>}
      <p className="data-status restore-status" role="status">{operation === "commit" ? "Restoring your journal… Please keep this page open." : restoreStatus}</p>
      {restoreError ? <p className="data-error" role="alert">{restoreError}</p> : null}
      {refreshError ? <div className="data-error" role="alert"><p>{refreshError}</p><button disabled={busy} onClick={() => { setOperation("refresh"); void refreshRestored().finally(() => setOperation(null)); }}>Retry refresh</button></div> : null}
    </section>
    <details className="data-disclosure mobile-appearance-panel" id="data-appearance"><summary>Appearance</summary><p>Choose the light that feels right for your journal.</p><ThemeSwitcher /><Link id="data-greeting" to={"/welcome?"+new URLSearchParams({return:location.pathname+location.search})}>Personalize your greeting →</Link></details>
    <details className="data-disclosure" id="data-privacy"><summary>Privacy</summary><h2>Private on this device</h2><p>Live records are stored in this browser profile without application-level encryption. Backup encryption protects the exported file, not the live database.</p><p>Removing an entry is not secure erasure. Retained text and deletion markers can remain in this browser and in backups you already made.</p><p>Browser persistence cannot replace an external backup. Keep a copy somewhere you can reach even if this browser or device is unavailable.</p></details>
    <details className="data-disclosure" id="data-advanced"><summary>Advanced</summary><section className="storage-resilience"><h2>Storage on this device</h2><p>Browser storage belongs to this site’s exact origin. Other applications hosted on the same origin share its storage trust boundary. Available space and eviction policies depend on your browser and device.</p>{storageError ? <p role="status">Storage information is unavailable. Backup controls remain usable. <button onClick={() => void refreshStorage()}>Retry storage check</button></p> : <dl className="storage-facts"><div><dt>Persistence</dt><dd>{storage ? storage.persistence === "granted" ? "Persistent storage granted" : storage.persistence === "not-granted" ? "Best-effort browser storage" : "Browser policy unavailable" : "Checking…"}</dd></div><div><dt>Storage used / quota</dt><dd>{storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : "Checking…"}</dd></div></dl>}{storage?.persistence === "not-granted" ? <button disabled={busy} onClick={() => void refreshStorage(true)}>Request persistent storage</button> : null}</section><h2>About this app</h2><p>Version {APP_VERSION} · Local database schema {DATABASE_SCHEMA_VERSION} · Backup format 1</p><details className="data-inner-disclosure"><summary>Earlier data corrections</summary><p>The 1.0.1 corrective release repaired duplicate reading records without erasing originals or History. The March 1 reading includes Exodus 12:51; existing completion choices were preserved.</p></details></details>
    {confirm && review ? <JournalDialog title={review.mode === "replace" ? "Replace this journal?" : "Merge this backup?"} close={() => setConfirm(false)} busy={operation === "commit"}><p>{review.mode === "replace" ? "Local-only records will be removed. This uses the exact backup and changes you just reviewed. Existing external backups are unaffected." : "Add missing records and apply the reviewed changes. Equal revisions keep the local version."}</p><p>{review.effects.additions} additions · {review.effects.replacements} replacements · {review.effects.removals} removals</p><div className="journal-dialog-actions"><button className="grace-primary" disabled={busy} onClick={() => void commit()}>{operation === "commit" ? "Restoring…" : review.mode === "merge" ? "Merge validated backup" : "Replace with validated backup"}</button><button data-initial-focus disabled={busy} onClick={() => setConfirm(false)}>Keep reviewing</button></div></JournalDialog> : null}
    {blocker.state === "blocked" && !confirm ? <JournalDialog title="Restore in progress" close={() => { if (!committing.current) blocker.reset(); }} busy={committing.current}><p>Please keep this page open until the current restore finishes.</p></JournalDialog> : null}
  </main>;
}
