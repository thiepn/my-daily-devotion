import { ChangeEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { inspectStorage, type StorageSnapshot } from "../app/platform";
import { APP_VERSION } from "../app/version";
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
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);

  const run = async (action: () => Promise<void>) => { setBusy(true); setStatus(""); try { await action(); } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Data operation failed."); } finally { setBusy(false); } };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; setPreview(null); if (!file) { setImportBytes(null); return; } setImportBytes(new Uint8Array(await file.arrayBuffer())); setStatus(`${file.name} selected. Preview and validate it before importing.`); };
  const refreshStorage = async (requestPersistence = false) => { try { setStorage(await inspectStorage(requestPersistence)); } catch { setStorage({ persistence: "unsupported", usage: null, quota: null }); } };
  useEffect(() => { void refreshStorage(false); }, []);

  return (
    <main className="visual-screen data-screen">
      <header className="screen-heading compact-heading"><p className="eyebrow">Data & privacy</p><h1>Your data</h1><p className="screen-intro">MDD is local-first. Backups are how your devotional history survives browser storage loss, device replacement, or a future app migration.</p><Link className="quiet-back-link" to="/today">← Back</Link></header>
      <div className="data-sections">
        <section className="storage-resilience" aria-labelledby="storage-heading">
          <p className="section-kicker">Device storage</p><h2 id="storage-heading">Local storage resilience</h2>
          <p>MDD asks supported browsers to keep its IndexedDB data from routine storage eviction. This is useful protection, but it is not a substitute for an external backup.</p>
          <dl className="storage-facts"><div><dt>Persistence</dt><dd>{storage?.persistence === "granted" ? "Protected where supported" : storage?.persistence === "not-granted" ? "Best-effort browser storage" : "Browser policy unavailable"}</dd></div><div><dt>Storage used / quota</dt><dd>{storage ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : "Checking…"}</dd></div></dl>
          {storage?.persistence === "not-granted" ? <button type="button" onClick={() => void refreshStorage(true)}>Request persistent storage</button> : null}
        </section>

        <section className="data-panel"><p className="section-kicker">Backup</p><h2>Portable MDD backup</h2><p>Create a checksum-verified <code>.mddbackup</code> archive. Plain backups are easy to inspect but should be treated as sensitive personal data.</p><div className="data-actions"><button type="button" disabled={busy} onClick={() => void run(async () => download(await createMddBackup(db, APP_VERSION), `mdd-${stamp()}.mddbackup`))}>Download plain backup</button></div><label className="data-password">Encrypted backup password<input type="password" autoComplete="new-password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} placeholder="At least 8 characters" /></label><button type="button" disabled={busy || exportPassword.length < 8} onClick={() => void run(async () => download(await createMddBackup(db, APP_VERSION, exportPassword), `mdd-${stamp()}-encrypted.mddbackup`))}>Download encrypted backup</button><p className="data-warning">There is no password recovery. Losing this password makes the encrypted backup unreadable.</p></section>

        <section className="data-panel"><p className="section-kicker">Human-readable archive</p><h2>Markdown export</h2><p>Export reflections, prayer history, highlights and verse notes as ordinary Markdown files, alongside a complete machine-readable <code>data.json</code>.</p><button type="button" disabled={busy} onClick={() => void run(async () => download(await createMarkdownArchive(db), `mdd-markdown-${stamp()}.zip`, "application/zip"))}>Download Markdown archive</button></section>

        <section className="data-panel import-panel"><p className="section-kicker">Restore / import</p><h2>Validate before changing anything.</h2><p>MDD opens the archive, verifies checksums, decrypts if necessary, restores it into a temporary IndexedDB database, and runs relational integrity checks before the live database is touched.</p><label className="data-password" htmlFor="backup-file">Backup file <span>.mddbackup</span></label><input id="backup-file" type="file" accept=".mddbackup,application/zip" onChange={(e) => void chooseFile(e)} /><label className="data-password">Backup password <span>only if encrypted</span><input type="password" autoComplete="current-password" value={importPassword} onChange={(e) => { setImportPassword(e.target.value); setPreview(null); }} /></label><fieldset className="import-mode"><legend>Restore mode</legend><label><input type="radio" name="restore-mode" checked={mode === "merge"} onChange={() => setMode("merge")} /> Merge</label><span>Add missing records and accept newer revisions; retain local records otherwise.</span><label><input type="radio" name="restore-mode" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace</label><span>Replace all current MDD data with the validated backup.</span></fieldset><button type="button" disabled={busy || !importBytes} onClick={() => void run(async () => { const result = await previewMddBackup(importBytes!, importPassword, db); setPreview(result); setStatus("Backup validated. No current data has been changed."); })}>Preview & validate</button>{preview ? <div className="backup-preview"><strong>{preview.encrypted ? "Encrypted" : "Plain"} MDD backup</strong><span>Exported {new Date(preview.manifest.exportedAt).toLocaleString()}</span><span>{Object.values(preview.counts).reduce((sum, value) => sum + value, 0)} records across {Object.keys(preview.counts).length} tables</span><button type="button" disabled={busy} onClick={() => void run(async () => { await importMddBackup(importBytes!, importPassword, mode, db); setStatus(`Backup ${mode === "merge" ? "merged" : "restored"} successfully. Reload MDD to refresh every open view.`); })}>{mode === "merge" ? "Merge validated backup" : "Replace with validated backup"}</button></div> : null}</section>
      </div>
      <p className="data-status" aria-live="polite">{status}</p>
    </main>
  );
}
