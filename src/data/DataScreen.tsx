import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { inspectStorage, type StorageSnapshot } from "../app/platform";
import { APP_VERSION } from "../app/version";
import { ThemeSwitcher } from "../app/visual/ThemeSwitcher";
import { db } from "./database";
import { createMarkdownArchive, createMddBackup, importMddBackup, previewMddBackup, type BackupPreview, type ImportMode } from "./portability";

function stamp(): string { return new Date().toISOString().slice(0, 10); }
function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer { const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes); return buffer; }
function download(bytes: Uint8Array, name: string, type = "application/octet-stream") { const blob = new Blob([ownedArrayBuffer(bytes)], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function formatBytes(value: number | null): string { if (value === null) return "Unavailable"; if (value < 1024) return `${value} B`; const units = ["KB", "MB", "GB", "TB"]; let next = value / 1024; let unit = units[0]!; for (let index = 1; next >= 1024 && index < units.length; index += 1) { next /= 1024; unit = units[index]!; } return `${next >= 10 ? next.toFixed(0) : next.toFixed(1)} ${unit}`; }

export function DataScreen() {
  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importBytes, setImportBytes] = useState<Uint8Array | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); const fileVersion = useRef(0);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);

  const run = async (action: () => Promise<void>) => { if (busyRef.current) return; busyRef.current=true; setBusy(true); setStatus(""); try { await action(); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Data operation failed."); } finally { busyRef.current=false; setBusy(false); } };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => { const version=++fileVersion.current; const file = event.target.files?.[0]; setPreview(null); setImportBytes(null); setConfirmReplace(false); if (!file) return; try { if(file.size>64*1024*1024)throw new Error("This backup exceeds the supported 64 MB file size."); const bytes=new Uint8Array(await file.arrayBuffer()); if(version!==fileVersion.current)return; setImportBytes(bytes); setStatus(`${file.name} selected. Preview and validate it before importing.`); } catch(reason) { if(version===fileVersion.current)setStatus(reason instanceof Error?reason.message:"Could not read this file."); } };
  const refreshStorage = async (requestPersistence = false) => { try { setStorage(await inspectStorage(requestPersistence)); } catch { setStorage({ persistence: "unsupported", usage: null, quota: null }); } };
  useEffect(() => { void refreshStorage(false); }, []);

  return (
    <main className="visual-screen data-screen mg-secondary-screen mg-data-workspace">
      <header className="screen-heading compact-heading mg-secondary-header"><p className="eyebrow">Data & privacy</p><h1>Your data</h1><p className="section-kicker">Version {APP_VERSION} · Local database schema 1</p><p className="screen-intro">Your devotional history stays on this device. Keep a backup somewhere safe so you can restore it when needed.</p><Link className="quiet-back-link" to="/today">← Back</Link></header>
      <p className="data-status" role="status" aria-live="polite">{busy ? "Working with your local data…" : status}</p>
      <section className="data-panel" aria-label="Privacy boundaries"><h2>Local does not mean encrypted.</h2><p>Your live records are stored in this browser profile without application-level encryption. The encrypted backup option protects the exported file, not the live database.</p><p>Removed entries are hidden with deletion markers; their retained text may remain in backups. Remove is not secure erasure. Other apps hosted on this exact origin share the browser-storage trust boundary.</p><p>The 1.0.1 corrective release repaired duplicate reading records without erasing originals or history. The March 1 reading now includes Exodus 12:51; existing completion choices are preserved.</p></section>
      <div className="data-sections">
        <section className="data-panel mobile-appearance-panel"><p className="section-kicker">Appearance</p><h2>Theme</h2><p>Choose how My Daily Devotion appears on this device.</p><ThemeSwitcher /></section>

        <section className="data-panel"><p className="section-kicker">Backup</p><h2>Portable MDD backup</h2><p>Save everything in a <code>.mddbackup</code> file. Choose an encrypted backup to protect its contents with a password.</p><div className="data-actions"><button type="button" disabled={busy} onClick={() => void run(async () => download(await createMddBackup(db, APP_VERSION), `mdd-${stamp()}.mddbackup`))}>Download plain backup</button></div><label className="data-password">Encrypted backup password<input type="password" autoComplete="new-password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} placeholder="At least 8 characters" /></label><button type="button" disabled={busy || exportPassword.length < 8} onClick={() => void run(async () => download(await createMddBackup(db, APP_VERSION, exportPassword), `mdd-${stamp()}-encrypted.mddbackup`))}>Download encrypted backup</button><p className="data-warning">There is no password recovery. Losing this password makes the encrypted backup unreadable.</p></section>

        <section className="data-panel"><p className="section-kicker">Human-readable archive</p><h2>Markdown export</h2><p>Export reflections, prayer history, highlights and verse notes as ordinary Markdown files, alongside a complete machine-readable <code>data.json</code>.</p><button type="button" disabled={busy} onClick={() => void run(async () => download(await createMarkdownArchive(db), `mdd-markdown-${stamp()}.zip`, "application/zip"))}>Download Markdown archive</button></section>

        <section className="data-panel import-panel"><p className="section-kicker">Restore / import</p><h2>Validate before changing anything.</h2><p>Choose a backup to check its contents. Your data changes only when you confirm the restore.</p><label className="data-password" htmlFor="backup-file">Backup file <span>.mddbackup</span></label><input id="backup-file" disabled={busy} type="file" accept=".mddbackup,application/zip" onChange={(e) => void chooseFile(e)} /><label className="data-password">Backup password <span>only if encrypted</span><input type="password" autoComplete="current-password" disabled={busy} value={importPassword} onChange={(e) => { setImportPassword(e.target.value); setPreview(null); }} /></label><fieldset className="import-mode"><legend>Restore mode</legend><label><input type="radio" name="restore-mode" checked={mode === "merge"} disabled={busy} onChange={() => {setMode("merge");setConfirmReplace(false);}} /> Merge</label><span>Add missing records and accept newer revisions; retain local records otherwise.</span><label><input type="radio" name="restore-mode" checked={mode === "replace"} disabled={busy} onChange={() => {setMode("replace");setConfirmReplace(false);}} /> Replace</label><span>Replace all current MDD data with the validated backup.</span></fieldset><button type="button" disabled={busy || !importBytes} onClick={() => void run(async () => { const result = await previewMddBackup(importBytes!, importPassword, db); setPreview(result); setStatus("Backup validated. No current data has been changed."); })}>Preview & validate</button>{preview ? <div className="backup-preview"><strong>{preview.encrypted ? "Encrypted" : "Plain"} MDD backup</strong><span>Exported {new Date(preview.manifest.exportedAt).toLocaleString()}</span><dl className="backup-counts">{[["reflections","Reflections"],["prayers","Prayers"],["verseNotes","Verse notes"],["collections","Collections"],["readingProgress","Reading records"],["activityEvents","History events"]].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{preview.counts[key!]??0}</dd></div>)}</dl>{mode==="replace"?<label className="replace-confirmation"><input type="checkbox" checked={confirmReplace} onChange={(event)=>setConfirmReplace(event.target.checked)}/>I understand this replaces all current MDD data.</label>:null}<button type="button" disabled={busy || (mode==="replace"&&!confirmReplace)} onClick={() => void run(async () => { await importMddBackup(importBytes!, importPassword, mode, db); setPreview(null);setConfirmReplace(false);setStatus(`Backup ${mode === "merge" ? "merged" : "restored"} successfully. Open any screen to see your restored data.`); })}>{mode === "merge" ? "Merge validated backup" : "Replace with validated backup"}</button><button type="button" disabled={busy} onClick={()=>{setPreview(null);setConfirmReplace(false);setStatus("Restore cancelled. Your data has not changed.");}}>Cancel restore</button></div> : null}</section>

        <section className="storage-resilience" aria-labelledby="storage-heading">
          <p className="section-kicker">Device storage</p><h2 id="storage-heading">Storage on this device</h2>
          <p>MDD asks your browser to keep your data. A backup also protects you if browser storage is cleared or you change devices.</p>
          <dl className="storage-facts"><div><dt>Persistence</dt><dd>{storage?.persistence === "granted" ? "Protected where supported" : storage?.persistence === "not-granted" ? "Best-effort browser storage" : "Browser policy unavailable"}</dd></div><div><dt>Storage used / quota</dt><dd>{storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : "Checking…"}</dd></div></dl>
          {storage?.persistence === "not-granted" ? <button type="button" onClick={() => void refreshStorage(true)}>Request persistent storage</button> : null}
        </section>
      </div>

    </main>
  );
}
