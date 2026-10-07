import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { ReflectionConflictError, ReflectionRepository } from "../data/repositories/reflections";
import { assertLocalDate } from "../domain/time";
import type { LocalDate, Reflection, ScriptureLink, ScriptureReference } from "../domain/types";
import type { DraftMetadata, DraftPayload, DraftSnapshot } from "../recovery/types";
import { DraftRepository } from "../recovery/repository";
import { useDurableDraft } from "../recovery/useDurableDraft";
import { saveJournalDraft } from "../recovery/editor-adapters";
import { isDraftReturnRoute } from "../recovery/validation";
import { parsePlanReadingLocator } from "../mcheyne/context";
import { JournalDialog, JournalHeading, WritingPreview } from "../writing/JournalPrimitives";
import { ScriptureContext } from "../writing/ScriptureContext";
import { useWritingGuard } from "../writing/useWritingGuard";
import { buildPrayerHandoffUrl, parsePendingScripture } from "./context";

const repository = new ReflectionRepository(db);
const prompts = ["What stood out?", "What does this show about God?", "What should I obey or change?", "What should I pray about?", "What am I thankful for?"];
const message = (reason: unknown) => reason instanceof Error ? reason.message : "Could not save. Your writing is still here.";

export function ReflectionScreen() {
  const { localDate = "" } = useParams();
  const location = useLocation();
  try { assertLocalDate(localDate); } catch {
    return <main className="journal-workspace"><h1>Invalid date</h1><p>This reflection date is not valid.</p><Link to="/today">Return to Today</Link></main>;
  }
  return <ReflectionEditor key={localDate + location.search} localDate={localDate as LocalDate} />;
}

function ReflectionEditor({ localDate }: { localDate: LocalDate }) {
  const location = useLocation(); const navigate = useNavigate(); const [params] = useSearchParams();
  const [pendingDismissed, setPendingDismissed] = useState(false);
  const pending = pendingDismissed ? null : parsePendingScripture(params);
  const [recoveredReturn, setRecoveredReturn] = useState<string | null>(null);
  const selfParams = new URLSearchParams(location.search);
  if (recoveredReturn) selfParams.set("return", recoveredReturn);
  const self = location.pathname + (selfParams.size ? `?${selfParams}` : "");
  const returnParam = recoveredReturn ?? params.get("return");
  const back = isDraftReturnRoute(returnParam) ? returnParam : "/today";
  const [edited, setEdited] = useState(false);
  const [recoveredReferences, setRecoveredReferences] = useState<ScriptureReference[]>([]);
  const [recoveredBaseline, setRecoveredBaseline] = useState<Extract<DraftPayload, { kind: "reflection" }>["baseline"] | undefined>();
  const [offers, setOffers] = useState<DraftMetadata[]>([]);
  const [review, setReview] = useState<{ snapshot: DraftSnapshot; previousJournal: boolean } | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const current = useRef<Reflection | null>(null);
  const [links, setLinks] = useState<ScriptureLink[]>([]);
  const [body, setBody] = useState(""); const bodyRef = useRef(""); const baseline = useRef("");
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(""); const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [conflict, setConflict] = useState<{ latest: Reflection | undefined } | null>(null);
  const [external, setExternal] = useState(false);
  const [foreground, setForeground] = useState(0);
  const [preview, setPreview] = useState(false); const [formatting, setFormatting] = useState(false); const [showPrompts, setShowPrompts] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false); const [removeError, setRemoveError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null); const selection = useRef({ start: 0, end: 0 });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setForeground(value => value + 1); };
    document.addEventListener("visibilitychange", refresh); window.addEventListener("focus", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  const changeBody = (text: string) => { bodyRef.current = text; setBody(text); };
  const pendingLinked = !pending || links.some(link => link.translationId === pending.translationId && link.startVerseKey === pending.startVerseKey && link.endVerseKey === pending.endVerseKey);
  const additionalReferences = recoveredReferences.filter(reference => !links.some(link => link.translationId === reference.translationId && link.startVerseKey === reference.startVerseKey && link.endVerseKey === reference.endVerseKey) && !(pending && pending.translationId === reference.translationId && pending.startVerseKey === reference.startVerseKey && pending.endVerseKey === reference.endVerseKey));
  const dirty = body !== baseline.current || !pendingLinked || additionalReferences.length > 0;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const draftPayload: Extract<DraftPayload, { kind: "reflection" }> = {
    kind: "reflection", localDate, bodyMd: body,
    baseline: recoveredBaseline === undefined ? current.current ? { id: current.current.id, revision: current.current.revision, bodyMd: baseline.current } : null : recoveredBaseline,
    pendingReferences: [...(pending && !pendingLinked ? [pending] : []), ...additionalReferences], dismissedReferences: pendingDismissed,
  };
  const reading = parsePlanReadingLocator(new URLSearchParams(back.split("?")[1]));
  const recovery = useDurableDraft(db, { returnTo: back, reading: reading ? { enrollmentId: reading.enrollmentId, assignmentSequence: reading.sequence, readingIndex: reading.readingIndex } : null }, edited && !loading && !loadError ? draftPayload : null, edited && dirty);
  useEffect(() => {
    if (loading || loadError) return;
    let cancelled = false;
    void new DraftRepository(db).list({ targetKey: `reflection:${localDate}`, limit: 100 }).then(page => {
      if (!cancelled) setOffers(page.rows.flatMap(row => row.metadata?.state === "active" && row.id !== recovery.controller.getId() ? [row.metadata] : []));
    }).catch(() => { if (!cancelled) setRecoveryError("Could not check for kept drafts. Your editor remains available."); });
    return () => { cancelled = true; };
  }, [loading, loadError, localDate, foreground, recovery.controller]);

  useEffect(() => {
    let cancelled = false; setLoading(true); setLoadError("");
    void (async () => {
      const existing = await repository.getDaily(localDate);
      const nextLinks = existing ? await repository.listScriptureLinks(existing.id) : [];
      if (cancelled) return;
      current.current = existing ?? null; setReflection(existing ?? null); setLinks(nextLinks);
      baseline.current = existing?.bodyMd ?? ""; changeBody(baseline.current); setLoading(false);
    })().catch(() => { if (!cancelled) { setLoadError("Could not open this reflection. Please try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [localDate, attempt]);

  useEffect(() => {
    if (loading || loadError) return;
    const subscription = liveQuery(async () => {
      const item = await repository.getDaily(localDate);
      return { item, links: item ? await repository.listScriptureLinks(item.id) : [] };
    }).subscribe({ next: ({ item, links: nextLinks }) => {
      if (lock.current) return;
      if ((item?.revision ?? null) !== (current.current?.revision ?? null) || item?.id !== current.current?.id) {
        if (dirtyRef.current) { setExternal(true); return; }
        current.current = item ?? null; setReflection(item ?? null);
        baseline.current = item?.bodyMd ?? ""; changeBody(baseline.current);
      }
      setLinks(nextLinks);
    }, error: () => setStatus("Could not refresh the saved version. Your writing is still here.") });
    return () => subscription.unsubscribe();
  }, [loading, loadError, localDate, foreground]);

  const save = async (): Promise<Reflection> => {
    if (lock.current) throw new Error("A save is already in progress.");
    if (!bodyRef.current.trim()) throw new Error("Write a reflection before saving.");
    if (conflict) throw new Error("Review the changed reflection before saving.");
    lock.current = true; setBusy(true); setStatus("");
    const text = bodyRef.current;
    try {
      recovery.controller.stage({ ...draftPayload, bodyMd: text });
      const committed = await recovery.controller.commit(context => saveJournalDraft(db, context), (latest, submitted, result) => {
        if (latest.kind !== "reflection" || submitted.kind !== "reflection") throw new Error("The reflection context changed.");
        return { ...latest, baseline: { ...result.marker.records[0]!, bodyMd: submitted.bodyMd.replace(/\r\n/g, "\n").trimEnd() }, pendingReferences: latest.pendingReferences.filter(reference => !submitted.pendingReferences.some(saved => saved.translationId === reference.translationId && saved.startVerseKey === reference.startVerseKey && saved.endVerseKey === reference.endVerseKey)) };
      });
      const saved = committed.reflection;
      if (!saved) { setStatus("The reflection was saved. Reopen it to refresh the saved record; do not repeat the save."); throw new Error("Saved locally; the record needs refreshing."); }
      if (!alive.current) return saved;
      const created = !current.current;
      current.current = saved; setReflection(saved); baseline.current = saved.bodyMd; setRecoveredBaseline(undefined); setRecoveredReferences([]);
      if (bodyRef.current === text) changeBody(saved.bodyMd);
      setExternal(false);
      setStatus(created ? "Reflection created and saved locally." : "Reflection saved locally.");
      setLinks(committed.links ?? []);
      return saved;
    } catch (reason) {
      if (alive.current) { if (reason instanceof ReflectionConflictError) setConflict({ latest: reason.latest }); setStatus(message(reason)); }
      throw reason;
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const saveForNavigation = async () => {
    await save();
    if (bodyRef.current !== baseline.current) throw new Error("You added more writing during the save. Save again or keep editing.");
  };
  const guard = useWritingGuard(!loading && !loadError && dirty, saveForNavigation, Boolean(body.trim()) && !conflict, undefined, async () => {
    await recovery.controller.discard();
    changeBody(baseline.current); setPendingDismissed(true); setRecoveredReferences([]); setRecoveredBaseline(undefined); setEdited(false); setStatus(""); setConflict(null);
  });
  const handoff = async () => {
    try {
      const record = dirty ? await save() : current.current;
      if (!record || !alive.current) return;
      if (bodyRef.current !== baseline.current) { setStatus("Your latest changes are still unsaved. Save again before continuing."); return; }
      guard.allowNavigation(); navigate(buildPrayerHandoffUrl(record, self));
    } catch { /* save reports the error without leaving the editor */ }
  };
  const insert = (before: string, after = "", placeholder = "text") => {
    setEdited(true);
    const { start, end } = selection.current;
    const selected = bodyRef.current.slice(start, end) || placeholder;
    changeBody(bodyRef.current.slice(0, start) + before + selected + after + bodyRef.current.slice(end));
    setPreview(false);
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start + before.length, start + before.length + selected.length); });
  };
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(localDate + "T12:00:00"));
  return <main className="journal-workspace journal-reflection mg-reflection-workspace">
    <JournalHeading title="Reflect" subtitle={date} back={back} />
    {loading ? <p role="status">Opening your local reflection…</p> : loadError ? <section role="alert"><p>{loadError}</p><button onClick={() => setAttempt(value => value + 1)}>Retry reflection</button></section> : <>
      {offers.length > 0 ? <details className="journal-context"><summary>Kept drafts for this date <span>{offers.length}</span></summary><p>Review a draft before choosing to recover it. Your editor is not replaced automatically.</p>{offers.map(offer => <button key={offer.id} disabled={busy} onClick={async () => {
        setRecoveryError("");
        try { const item = await new DraftRepository(db).read(offer.id); if (!alive.current) return; if (item.kind !== "active") throw new Error("This draft is no longer available for recovery."); setReview({ snapshot: item.snapshot, previousJournal: item.previousJournal }); }
        catch (reason) { if (alive.current) setRecoveryError(message(reason)); }
      }}>Review draft kept {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(offer.updatedAt))}</button>)}</details> : null}
      {recoveryError ? <p role="alert">{recoveryError}</p> : null}
      {(links.length > 0 || pending || additionalReferences.length > 0) ? <details className="journal-context"><summary>From Scripture <span>{links.length + (pendingLinked ? 0 : 1) + additionalReferences.length} passage{links.length + (pendingLinked ? 0 : 1) + additionalReferences.length === 1 ? "" : "s"}</span></summary>
        {pending && !pendingLinked ? <ScriptureContext reference={pending} returnTo={self} pending /> : null}
        {additionalReferences.map(reference => <ScriptureContext key={`${reference.startVerseKey}:${reference.endVerseKey}`} reference={reference} returnTo={self} pending />)}
        {links.map(link => <div key={link.id}><ScriptureContext reference={link} returnTo={self} /><button className="journal-detach" disabled={busy} onClick={async () => {
          try {
            await repository.detachScripture(link.id);
            if (pending && pending.translationId === link.translationId && pending.startVerseKey === link.startVerseKey && pending.endVerseKey === link.endVerseKey) setPendingDismissed(true);
            setLinks(previous => previous.filter(item => item.id !== link.id));
          }
          catch { setStatus("Could not detach the passage. Please try again."); }
        }} aria-label={`Detach ${link.startVerseKey}`}>Detach passage</button></div>)}
      </details> : null}
      <section className="journal-paper" aria-label="Reflection editor">
        <div className="journal-editor-top"><div className="journal-tabs" role="group" aria-label="Editor mode"><button aria-pressed={!preview} onClick={() => { setPreview(false); requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(selection.current.start, selection.current.end); }); }}>Write</button><button aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button></div><span className="save-state">{busy ? "Saving…" : dirty ? "Unsaved changes" : reflection ? "Saved locally" : "Not saved yet"}</span></div>
        {preview ? <WritingPreview text={body} /> : <textarea ref={textarea} readOnly={busy} className="journal-textarea reflection-textarea" aria-label="Daily reflection" value={body} placeholder="What would you like to remember from today?" onCompositionEnd={event => { setEdited(true); changeBody(event.currentTarget.value); recovery.controller.stage({ ...draftPayload, bodyMd: event.currentTarget.value }); void recovery.controller.flush().catch(() => undefined); }} onBlur={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={event => { setEdited(true); changeBody(event.target.value); setStatus(""); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save().catch(() => undefined); } }} />}
        <div className="journal-tools"><button aria-expanded={formatting} onClick={() => setFormatting(value => !value)}>Formatting</button><button aria-expanded={showPrompts} onClick={() => setShowPrompts(value => !value)}>Optional prompts</button></div>
        {formatting ? <div className="journal-formatting" aria-label="Reflection formatting">{[["Bold", "**", "**", "bold text"], ["Italic", "_", "_", "italic text"], ["• List", "- ", "", "list item"], ["1. List", "1. ", "", "list item"], ["Quote", "> ", "", "quote"], ["Link", "[", "](https://)", "link text"]].map(([label, before, after, placeholder]) => <button key={label} onClick={() => insert(before!, after, placeholder)}>{label}</button>)}</div> : null}
        {showPrompts ? <div className="journal-prompts">{prompts.map(prompt => <button key={prompt} disabled={busy} onClick={() => { setEdited(true); changeBody(bodyRef.current + (bodyRef.current.trim() ? "\n\n" : "") + "### " + prompt + "\n"); setPreview(false); requestAnimationFrame(() => { textarea.current?.focus(); const length = bodyRef.current.length; textarea.current?.setSelectionRange(length, length); }); }}>{prompt}</button>)}</div> : null}
      </section>
      <p className="draft-status journal-help" role="status">{recovery.status === "keeping" ? "Keeping draft…" : recovery.status === "kept" ? "Draft kept on this device" : recovery.status === "copy-only" ? "Action already recorded. Remaining writing is kept for copying." : ""}</p>
      {recovery.status === "failed" ? <section className="journal-notice" role="alert"><p>Draft could not be kept — keep this page open. {recovery.error}</p><button onClick={() => void recovery.retry().catch(() => undefined)}>Retry keeping draft</button><p>You can select and copy your writing from the editor.</p></section> : null}
      {external ? <p className="journal-notice">The saved reflection changed in another tab. Your writing has been kept; saving will check the latest version.</p> : null}
      <p className="reflection-status journal-status" aria-live="polite">{status}</p>
      {conflict ? <section className="journal-conflict" aria-label="Edit conflict"><h2>Keep what matters.</h2><p>Compare both versions before choosing how to continue.</p><label>Your unsaved writing<textarea readOnly value={body} /></label><label>Latest saved version<textarea readOnly value={conflict.latest?.bodyMd ?? "This reflection was removed."} /></label><div className="journal-actions">
        <button onClick={async () => { try { await recovery.controller.discard(); const latest = conflict.latest; current.current = latest ?? null; baseline.current = latest?.bodyMd ?? ""; setReflection(latest ?? null); changeBody(baseline.current); setRecoveredReferences([]); setRecoveredBaseline(undefined); setEdited(false); setConflict(null); setExternal(false); setStatus("Saved version opened. No writing was saved."); setForeground(value => value + 1); } catch (reason) { setStatus(message(reason)); } }}>Use saved version</button>
        <button disabled={!conflict.latest} onClick={() => { current.current = conflict.latest ?? null; baseline.current = conflict.latest?.bodyMd ?? ""; setRecoveredBaseline(undefined); setConflict(null); setStatus("Your writing is ready to review and save. The saved version has not been changed."); setForeground(value => value + 1); }}>Keep my writing for the next save</button>
      </div></section> : null}
      <div className="journal-actions"><button className="grace-primary" disabled={busy || !dirty || !body.trim() || Boolean(conflict)} onClick={() => void save().catch(() => undefined)}>Save reflection</button></div>
      <section className="journal-handoff"><p className="journal-kicker">Bring it to Him</p><h2>Let your reflection become prayer.</h2><p>Your saved reflection and linked Scripture will stay connected.</p><button disabled={busy || !body.trim() || Boolean(conflict)} onClick={() => void handoff()}>{dirty ? "Save and continue to prayer" : "Bring into prayer"} <span aria-hidden="true">→</span></button></section>
      <p className="journal-help">Kept drafts can be recovered on this device. Save to record your reflection. The latest edits may not be kept yet; drafts do not replace external backups.</p>
      {reflection ? <button className="journal-remove" onClick={() => { setRemoveError(""); setRemoveOpen(true); }} disabled={busy}>Remove reflection</button> : null}
    </>}
    {guard.dialog}
    {review && review.snapshot.contents.payload.kind === "reflection" ? <JournalDialog title="Review kept reflection" close={() => { setReview(null); setRecoveryError(""); }} busy={busy}><div className="journal-comparison"><label>Your kept draft<textarea readOnly value={review.snapshot.contents.payload.bodyMd} /></label><label>Saved version<textarea readOnly value={current.current?.bodyMd ?? "No saved reflection is available."} /></label></div>{review.previousJournal ? <p>This writing belongs to a previous local journal. Copy it for now; it cannot be attached automatically.</p> : edited && dirty ? <p>Save or discard your current writing before recovering this draft.</p> : null}{recoveryError ? <p role="alert">{recoveryError}</p> : null}<div className="journal-dialog-actions"><button className="grace-primary" disabled={busy || review.previousJournal || (edited && dirty) || review.snapshot.metadata.commitment?.disposition === "copy-only"} onClick={async () => {
      setBusy(true); setRecoveryError("");
      try {
        const payload = await recovery.controller.recover(review.snapshot.metadata.id, review.snapshot.metadata.generation);
        if (!alive.current || payload.kind !== "reflection") return;
        const existing = current.current;
        const changed = payload.baseline ? existing?.id !== payload.baseline.id || existing?.revision !== payload.baseline.revision : Boolean(existing);
        setRecoveredReturn(review.snapshot.metadata.context.returnTo); setRecoveredBaseline(payload.baseline); baseline.current = payload.baseline?.bodyMd ?? ""; changeBody(payload.bodyMd); setPendingDismissed(payload.dismissedReferences); setRecoveredReferences(payload.pendingReferences); setEdited(true);
        if (changed) setConflict({ latest: existing ?? undefined });
        setReview(null); setStatus("Draft recovered on this device. No reflection has been saved."); setOffers(previous => previous.filter(item => item.id !== review.snapshot.metadata.id));
      } catch (reason) { if (alive.current) setRecoveryError(message(reason)); }
      finally { if (alive.current) setBusy(false); }
    }}>Recover for review</button><button data-initial-focus disabled={busy} onClick={() => { setReview(null); setRecoveryError(""); }}>Keep current editor</button></div></JournalDialog> : null}
    {removeOpen ? <JournalDialog title="Remove this reflection?" close={() => setRemoveOpen(false)} busy={busy}><p>This removes the saved reflection and its linked passages. Unsaved changes in this editor will also be discarded.</p>{removeError ? <p role="alert">{removeError}</p> : null}<div className="journal-dialog-actions"><button disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true);
      try { await recovery.controller.discard({ tables: ["reflections", "scriptureLinks"], action: () => repository.removeDaily(localDate, current.current?.revision) }); current.current = null; setReflection(null); baseline.current = ""; changeBody(""); setLinks([]); setRecoveredReferences([]); setRecoveredBaseline(undefined); setEdited(false); setConflict(null); setRemoveOpen(false); setStatus("Reflection removed."); }
      catch (reason) { setRemoveError(reason instanceof ReflectionConflictError ? "The saved reflection changed. Keep it and review the latest version before removing it." : "Could not remove the reflection. Your writing is still here."); }
      finally { lock.current = false; setBusy(false); }
    }}>Remove reflection</button><button data-initial-focus disabled={busy} onClick={() => setRemoveOpen(false)}>Keep reflection</button></div></JournalDialog> : null}
  </main>;
}
