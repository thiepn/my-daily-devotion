import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../data/database";
import { JournalDialog, JournalHeading } from "../writing/JournalPrimitives";
import { usePrayerPosition, usePrayerRead } from "../prayer/detail-hooks";
import { usePrayerDraftGuard } from "../prayer/usePrayerDraftGuard";
import { SavedVersionRepository } from "./saved-versions";
import { restoreSavedVersion, type RestoreVersionResult } from "./restore-version";
import { RecoveryNavigation } from "./SavedVersionsLink";
import { parseVersionContext, readVersionComparison, savedVersionsUrl, VERSION_LABELS, versionFields, type VersionComparison } from "./version-presentation";

const repository = new SavedVersionRepository(db);
const time = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
type Available = Extract<VersionComparison, { kind: "available" }>;
function CopyableWriting({ writing, prefix }: { writing: Parameters<typeof versionFields>[0]; prefix: string }) {
  return <>{versionFields(writing).map((field, index) => <div className="version-field" key={field.label}><label htmlFor={`${prefix}-${index}`}>{field.label}</label><textarea id={`${prefix}-${index}`} readOnly value={field.text} /><button className="quiet-button" onClick={() => { const element = document.getElementById(`${prefix}-${index}`) as HTMLTextAreaElement | null; element?.focus(); element?.select(); }}>Select {field.label.toLowerCase()} to copy</button></div>)}</>;
}
export function SavedVersionsScreen() {
  const location = useLocation();
  return <VersionView key={location.pathname + location.search} />;
}
function VersionView() {
  const { versionId } = useParams(), location = useLocation(), navigate = useNavigate();
  const context = parseVersionContext(location.search), url = location.pathname + location.search;
  const directory = savedVersionsUrl(null, context.returnTo, context.shown, context.target);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("target") && params.get("target") !== context.target || params.has("shown") && params.get("shown") !== String(context.shown) || params.has("return") && params.get("return") !== context.returnTo)
      navigate(savedVersionsUrl(versionId ?? null, context.returnTo, context.shown, context.target), { replace: true });
  }, [location.search, context.returnTo, context.shown, context.target, versionId, navigate]);
  const [confirmation, setConfirmation] = useState<Available | null>(null);
  const [busy, setBusy] = useState(false), [result, setResult] = useState<RestoreVersionResult | null>(null);
  const lock = useRef(false);
  const guard = usePrayerDraftGuard({ dirty: false, pending: busy, save: async () => undefined, discard: () => undefined });
  const listing = usePrayerRead(`versions:${context.target}:${context.shown}`, async () => {
    if (versionId) return { rows: [], total: 0 } as Awaited<ReturnType<typeof repository.list>>;
    const page = await repository.list({ ...(context.target ? { targetKey: context.target } : {}), limit: Math.min(100, context.shown) });
    for (let offset = 100; offset < Math.min(context.shown, page.total); offset += 100) {
      const more = await repository.list({ ...(context.target ? { targetKey: context.target } : {}), offset, limit: Math.min(100, context.shown - offset) });
      page.rows.push(...more.rows); page.total = more.total;
    }
    return page;
  });
  const comparison = usePrayerRead(`version:${versionId ?? "none"}`, async () => versionId ? readVersionComparison(db, versionId) : null);
  const selected = comparison.data?.kind === "available" ? comparison.data : null;
  const error = versionId ? comparison.error : listing.error;
  usePrayerPosition(url, Boolean(versionId ? comparison.data : listing.data), null, ".recovery-journal", "version-entry-");
  async function restore() {
    if (lock.current || !confirmation?.current) return;
    lock.current = true; setBusy(true);
    try {
      const committed = await restoreSavedVersion(db, confirmation.metadata.id, confirmation.current.revision, confirmation.fingerprint);
      setResult(committed); setConfirmation(null);
      if (committed.kind === "committed" || committed.kind === "unchanged") comparison.retry();
    } finally { lock.current = false; setBusy(false); }
  }
  const committed = result?.kind === "committed" || result?.kind === "unchanged";
  return <main className="journal-workspace recovery-journal saved-version-journal">
    <JournalHeading title={versionId ? "Earlier writing" : "Saved versions"} subtitle="A little room to return" back={versionId ? directory : context.returnTo} />
    {!versionId ? <RecoveryNavigation returnTo={context.returnTo} versions /> : null}
    <p className="journal-help">The previous twenty versions of supported writing stay on this device. Restoring keeps the entry’s identity and recorded date. Ordinary backups do not include these versions.</p>
    {error ? <section className="journal-notice" role="alert"><p>{error}</p><button onClick={versionId ? comparison.retry : listing.retry}>Retry refresh</button></section> : null}
    {result ? <section className="journal-notice" role="status"><p>{committed ? result.kind === "unchanged" ? "This writing already matches. Nothing was changed." : "The selected writing was restored locally. Your previous writing is now another saved version." : result.kind === "conflict" ? "The saved entry changed while you were reviewing. Review the current writing before choosing again." : "reason" in result ? result.reason : ""}</p>{!committed ? <button onClick={() => { setResult(null); comparison.retry(); }}>Review current writing</button> : <Link to={context.returnTo}>Return to entry</Link>}</section> : null}
    {!versionId ? listing.data ? <>
      {context.target ? <p className="journal-help">Showing versions for this entry. <Link to={savedVersionsUrl(null, context.returnTo)}>Show all saved versions</Link></p> : null}
      {listing.data.total ? <ul className="recovery-directory">{listing.data.rows.map(row => <li key={row.id}><Link id={`version-entry-${row.id}`} to={savedVersionsUrl(row.id, context.returnTo, context.shown, context.target)}><span><strong>{row.metadata ? VERSION_LABELS[row.metadata.kind] : "Unavailable version"}</strong>{row.metadata ? <><small>{row.metadata.writingDate ?? "Saved writing"} · Revision {row.metadata.originalRevision}</small><small>Kept {time(row.metadata.capturedAt)}</small></> : <small>Review this entry</small>}</span><span aria-hidden="true">›</span></Link></li>)}</ul> : <section className="journal-paper recovery-empty"><h2>No earlier writing here yet.</h2><p>Earlier versions appear when you explicitly change supported saved writing. New entries and unchanged saves do not create versions.</p></section>}
      {listing.data.total ? <div className="recovery-pagination"><p>{listing.data.rows.length} of {listing.data.total} versions</p>{listing.data.rows.length < listing.data.total ? <Link className="quiet-button" id="version-show-more" to={savedVersionsUrl(null, context.returnTo, context.shown + 20, context.target)} replace>Show more</Link> : null}</div> : null}
    </> : !error ? <p role="status">Opening saved versions…</p> : null : selected ? <>
      <p className="recovery-kept-time">{VERSION_LABELS[selected.metadata.kind]} · Revision {selected.metadata.originalRevision}<br />Kept {time(selected.metadata.capturedAt)}</p>
      {selected.reason ? <p className="journal-notice">{selected.reason}</p> : null}
      <div className="version-comparison"><section className="journal-paper recovery-writing"><h2>Your current writing</h2>{selected.currentWriting ? <CopyableWriting writing={selected.currentWriting} prefix="version-current" /> : <p>The original saved entry is unavailable.</p>}</section><section className="journal-paper recovery-writing"><h2>Selected saved version</h2><CopyableWriting writing={selected.contents.writing} prefix="version-selected" /></section></div>
      {!selected.reason && !committed ? selected.same ? <p className="journal-help">This version matches your current writing.</p> : <button className="grace-primary" disabled={busy || Boolean(result)} onClick={() => setConfirmation(selected)}>Restore this writing</button> : null}
    </> : comparison.data ? <section className="journal-paper recovery-empty"><h2>This version is unavailable.</h2><p>Return to saved versions to check other writing. Nothing has been changed.</p></section> : !error ? <p role="status">Opening earlier writing…</p> : null}
    {confirmation ? <JournalDialog title="Restore this writing?" busy={busy} close={() => setConfirmation(null)}><p>The reviewed version will replace the current writing. The current writing will be kept as an earlier version. This does not record new devotional activity.</p><section className="version-confirmation"><h3>Selected saved version</h3>{versionFields(confirmation.contents.writing).map(field => <p key={field.label}><strong>{field.label}</strong><br />{field.text || "Empty"}</p>)}</section><div className="journal-dialog-actions"><button className="grace-primary" disabled={busy} onClick={() => void restore()}>{busy ? "Restoring…" : "Restore writing"}</button><button data-initial-focus disabled={busy} onClick={() => setConfirmation(null)}>Keep current writing</button></div></JournalDialog> : null}
    {guard.dialog}
  </main>;
}
