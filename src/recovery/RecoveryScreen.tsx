import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../data/database";
import { JournalDialog, JournalHeading } from "../writing/JournalPrimitives";
import { useUpdateProtection } from "../app/useUpdateProtection";
import { usePrayerPosition } from "../prayer/detail-hooks";
import { DraftRepository } from "./repository";
import { DRAFT_LABELS, draftFields, draftTargetLabel, parseRecoveryContext, recoveryUrl, reflectionRecoveryDestination } from "./presentation";
import type { DraftPage, DraftReadResult } from "./types";

const repository = new DraftRepository(db);
const message = (reason: unknown) => reason instanceof Error ? reason.message : "Could not open recovery. Please try again.";
function keptTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export function RecoveryScreen() {
  const location = useLocation();
  return <RecoveryView key={location.pathname + location.search} />;
}

function RecoveryView() {
  const { draftId } = useParams(), location = useLocation(), navigate = useNavigate();
  const context = parseRecoveryContext(location.search);
  const directory = recoveryUrl(null, context.returnTo, context.shown);
  const [page, setPage] = useState<DraftPage | null>(null), [result, setResult] = useState<DraftReadResult | null>(null);
  const [destination, setDestination] = useState<string | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [targetError, setTargetError] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [discardError, setDiscardError] = useState("");
  const [discardTarget, setDiscardTarget] = useState<{ id: string; generation: number } | null>(null);
  const lock = useRef(false), alive = useRef(true);
  useUpdateProtection(busy);
  usePrayerPosition(location.pathname + location.search, Boolean(draftId ? result : page), null, ".recovery-journal");
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setAttempt(value => value + 1); };
    const subscription = liveQuery(() => Promise.all([db.editorDrafts.count(), db.draftJournalState.get("journal"), db.reflections.count()])).subscribe({ next: refresh, error: () => undefined });
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { subscription.unsubscribe(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setError(""); setTargetError("");
    void (async () => {
      if (draftId) {
        if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(draftId)) { if (!cancelled) setResult({ kind: "missing" }); return; }
        const next = await repository.read(draftId);
        if (!cancelled) setResult(next);
        try { const target = await reflectionRecoveryDestination(db, next); if (!cancelled) setDestination(target); }
        catch { if (!cancelled) setTargetError("Could not check the saved entry. Your kept writing remains available for copying."); }
      } else {
        const next = await repository.list({ limit: Math.min(100, context.shown) });
        for (let offset = 100; offset < Math.min(context.shown, next.total); offset += 100) {
          const more = await repository.list({ offset, limit: Math.min(100, context.shown - offset) });
          next.rows.push(...more.rows); next.total = more.total;
        }
        if (!cancelled) setPage(next);
      }
    })().catch(reason => { if (!cancelled) setError(message(reason)); });
    return () => { cancelled = true; };
  }, [draftId, context.shown, attempt]);

  const metadata = result?.kind === "active" ? result.snapshot.metadata : result?.kind === "committed" ? result.metadata : null;
  const payload = result?.kind === "active" ? result.snapshot.contents.payload : null;
  async function discard() {
    if (lock.current || !discardTarget) return;
    lock.current = true; setBusy(true); setDiscardError("");
    try {
      await repository.discard(discardTarget.id, discardTarget.generation);
      if (alive.current) { setConfirm(false); navigate(directory, { replace: true }); }
    } catch (reason) { if (alive.current) setDiscardError(message(reason)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  return <main className="journal-workspace recovery-journal">
    <JournalHeading title={draftId ? "Kept writing" : "Recovery"} subtitle="Still here on this device" back={draftId ? directory : context.returnTo} />
    <p className="journal-help">Drafts protect unfinished writing on this device. They are separate from saved journal entries and are not included in ordinary backups.</p>
    {error ? <section className="journal-notice" role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry recovery</button></section> : null}
    {!draftId ? page ? <>
      {page.total === 0 ? <section className="journal-paper recovery-empty"><h2>No unfinished writing here.</h2><p>Kept drafts will appear here. Your saved journal entries remain in their usual places.</p></section> : <ul className="recovery-directory">{page.rows.map(row => <li key={row.id}><Link id={`recovery-entry-${row.id}`} to={recoveryUrl(row.id, context.returnTo, context.shown)}><span><strong>{row.metadata ? DRAFT_LABELS[row.metadata.kind] : "Unavailable draft"}</strong><small>{row.metadata ? draftTargetLabel(row.metadata) : "This app cannot read its details."}</small><small>{row.metadata ? `${row.metadata.state === "committed" ? "Saved action" : "Kept"} · ${keptTime(row.metadata.updatedAt)}` : "Review this entry"}</small></span><span aria-hidden="true">›</span></Link></li>)}</ul>}
      {page.total > 0 ? <div className="recovery-pagination"><p>{page.rows.length} of {page.total} entries</p>{page.rows.length < page.total ? <Link id="recovery-show-more" className="quiet-button" to={recoveryUrl(null, context.returnTo, context.shown + 20)} replace>Show more</Link> : null}</div> : null}
    </> : !error ? <p role="status">Opening recovery…</p> : null : result ? <>
      {metadata ? <p className="recovery-kept-time">{DRAFT_LABELS[metadata.kind]} · {draftTargetLabel(metadata)}<br />Kept {keptTime(metadata.updatedAt)}</p> : null}
      {payload ? <>
        {targetError ? <p role="status">{targetError} <button onClick={() => setAttempt(value => value + 1)}>Retry saved-entry check</button></p> : null}
        {result.kind === "active" && result.previousJournal ? <p className="journal-notice">This writing belongs to a previous local journal. Keep it for copying; it cannot be attached automatically.</p> : metadata?.commitment?.disposition === "copy-only" ? <p className="journal-notice">The action was already recorded. This remaining writing is available for copying; do not record the action again.</p> : null}
        <section className="journal-paper recovery-writing">{draftFields(payload).map((field, index) => <label key={field.label} htmlFor={`recovery-field-${index}`}>{field.label}<textarea id={`recovery-field-${index}`} readOnly value={field.text} /><button className="quiet-button" onClick={() => { const fieldElement = document.getElementById(`recovery-field-${index}`) as HTMLTextAreaElement | null; fieldElement?.focus(); fieldElement?.select(); }}>Select {field.label.toLowerCase()} to copy</button></label>)}</section>
        {destination ? <><p className="journal-help">Open the editor to compare the kept draft with the current saved entry. Nothing is adopted until you choose Recover.</p><Link className="grace-primary" to={destination}>{payload.kind === "prayer-create" ? "Review in Add prayer" : payload.kind === "verse-note" ? "Review in Bible" : "Review in Reflect"}</Link></> : <p className="journal-help">This writing is available for copying. Its editor may not support recovery yet, or its original record may have been removed or become read-only.</p>}
      </> : <section className="journal-paper recovery-empty"><h2>{result.kind === "committed" ? "The save was recorded." : "This draft is unavailable."}</h2><p>{result.kind === "committed" ? "No unfinished text remains in this entry. Its saved journal record is separate from this recovery acknowledgment." : result.kind === "unsupported" ? "This app version cannot read this draft. Keep it until a compatible version is available." : "It may have been saved, discarded, removed or changed. Return to the directory to check other writing."}</p></section>}
      {metadata ? <button className="journal-remove" disabled={busy} onClick={() => { setDiscardTarget({ id: metadata.id, generation: metadata.generation }); setDiscardError(""); setConfirm(true); }}>Discard this recovery entry</button> : null}
    </> : !error ? <p role="status">Opening kept writing…</p> : null}
    {confirm && metadata ? <JournalDialog title="Discard kept writing?" busy={busy} close={() => setConfirm(false)}><p>This removes this recovery entry from this device. Saved journal records and existing backups are unaffected.</p>{discardError ? <p role="alert">{discardError}</p> : null}<div className="journal-dialog-actions"><button disabled={busy} onClick={() => void discard()}>{busy ? "Discarding…" : "Discard kept writing"}</button><button data-initial-focus disabled={busy} onClick={() => setConfirm(false)}>Keep writing</button></div></JournalDialog> : null}
  </main>;
}
