import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { ReflectionConflictError, ReflectionRepository } from "../data/repositories/reflections";
import { assertLocalDate } from "../domain/time";
import type { LocalDate, Reflection, ScriptureLink } from "../domain/types";
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
  const self = location.pathname + location.search;
  const returnParam = params.get("return");
  const back = returnParam?.startsWith("/") && !returnParam.startsWith("//") ? returnParam : "/today";
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
  const dirty = body !== baseline.current || !pendingLinked;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;

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
      const result = await repository.saveDaily(localDate, text, current.current?.revision ?? null, pending && !pendingLinked ? pending : undefined);
      if (!alive.current) return result.reflection;
      current.current = result.reflection; setReflection(result.reflection); baseline.current = result.reflection.bodyMd;
      if (bodyRef.current === text) changeBody(result.reflection.bodyMd);
      setExternal(false);
      setStatus(result.created ? "Reflection created and saved locally." : "Reflection saved locally.");
      setLinks(result.links);
      return result.reflection;
    } catch (reason) {
      if (alive.current) { if (reason instanceof ReflectionConflictError) setConflict({ latest: reason.latest }); setStatus(message(reason)); }
      throw reason;
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const saveForNavigation = async () => {
    await save();
    if (bodyRef.current !== baseline.current) throw new Error("You added more writing during the save. Save again or keep editing.");
  };
  const guard = useWritingGuard(!loading && !loadError && dirty, saveForNavigation, Boolean(body.trim()) && !conflict);
  const handoff = async () => {
    try {
      const record = dirty ? await save() : current.current;
      if (!record || !alive.current) return;
      if (bodyRef.current !== baseline.current) { setStatus("Your latest changes are still unsaved. Save again before continuing."); return; }
      guard.allowNavigation(); navigate(buildPrayerHandoffUrl(record, self));
    } catch { /* save reports the error without leaving the editor */ }
  };
  const insert = (before: string, after = "", placeholder = "text") => {
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
      {(links.length > 0 || pending) ? <details className="journal-context"><summary>From Scripture <span>{links.length + (pendingLinked ? 0 : 1)} passage{links.length + (pendingLinked ? 0 : 1) === 1 ? "" : "s"}</span></summary>
        {pending && !pendingLinked ? <ScriptureContext reference={pending} returnTo={self} pending /> : null}
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
        {preview ? <WritingPreview text={body} /> : <textarea ref={textarea} className="journal-textarea reflection-textarea" aria-label="Daily reflection" value={body} placeholder="What would you like to remember from today?" onBlur={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={event => { changeBody(event.target.value); setStatus(""); }} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void save().catch(() => undefined); } }} />}
        <div className="journal-tools"><button aria-expanded={formatting} onClick={() => setFormatting(value => !value)}>Formatting</button><button aria-expanded={showPrompts} onClick={() => setShowPrompts(value => !value)}>Optional prompts</button></div>
        {formatting ? <div className="journal-formatting" aria-label="Reflection formatting">{[["Bold", "**", "**", "bold text"], ["Italic", "_", "_", "italic text"], ["• List", "- ", "", "list item"], ["1. List", "1. ", "", "list item"], ["Quote", "> ", "", "quote"], ["Link", "[", "](https://)", "link text"]].map(([label, before, after, placeholder]) => <button key={label} onClick={() => insert(before!, after, placeholder)}>{label}</button>)}</div> : null}
        {showPrompts ? <div className="journal-prompts">{prompts.map(prompt => <button key={prompt} onClick={() => { changeBody(bodyRef.current + (bodyRef.current.trim() ? "\n\n" : "") + "### " + prompt + "\n"); setPreview(false); requestAnimationFrame(() => { textarea.current?.focus(); const length = bodyRef.current.length; textarea.current?.setSelectionRange(length, length); }); }}>{prompt}</button>)}</div> : null}
      </section>
      {external ? <p className="journal-notice">The saved reflection changed in another tab. Your writing has been kept; saving will check the latest version.</p> : null}
      <p className="reflection-status journal-status" aria-live="polite">{status}</p>
      {conflict ? <section className="journal-conflict" aria-label="Edit conflict"><h2>Keep what matters.</h2><p>Compare both versions before choosing how to continue.</p><label>Your unsaved writing<textarea readOnly value={body} /></label><label>Latest saved version<textarea readOnly value={conflict.latest?.bodyMd ?? "This reflection was removed."} /></label><div className="journal-actions">
        <button onClick={() => { const latest = conflict.latest; current.current = latest ?? null; baseline.current = latest?.bodyMd ?? ""; setReflection(latest ?? null); changeBody(baseline.current); setConflict(null); setExternal(false); setStatus("Saved version opened. No writing was saved."); setForeground(value => value + 1); }}>Use saved version</button>
        <button onClick={() => { current.current = conflict.latest ?? null; baseline.current = conflict.latest?.bodyMd ?? ""; setConflict(null); setStatus("Your writing is ready to review and save. The saved version has not been changed."); setForeground(value => value + 1); }}>Keep my writing for the next save</button>
      </div></section> : null}
      <div className="journal-actions"><button className="grace-primary" disabled={busy || !dirty || !body.trim() || Boolean(conflict)} onClick={() => void save().catch(() => undefined)}>Save reflection</button></div>
      <section className="journal-handoff"><p className="journal-kicker">Bring it to Him</p><h2>Let your reflection become prayer.</h2><p>Your saved reflection and linked Scripture will stay connected.</p><button disabled={busy || !body.trim() || Boolean(conflict)} onClick={() => void handoff()}>{dirty ? "Save and continue to prayer" : "Bring into prayer"} <span aria-hidden="true">→</span></button></section>
      <p className="journal-help">Save to keep your writing on this device. Unsaved changes are lost when the app closes.</p>
      {reflection ? <button className="journal-remove" onClick={() => { setRemoveError(""); setRemoveOpen(true); }} disabled={busy}>Remove reflection</button> : null}
    </>}
    {guard.dialog}
    {removeOpen ? <JournalDialog title="Remove this reflection?" close={() => setRemoveOpen(false)} busy={busy}><p>This removes the saved reflection and its linked passages. Unsaved changes in this editor will also be discarded.</p>{removeError ? <p role="alert">{removeError}</p> : null}<div className="journal-dialog-actions"><button disabled={busy} onClick={async () => {
      if (lock.current) return; lock.current = true; setBusy(true);
      try { await repository.removeDaily(localDate, current.current?.revision); current.current = null; setReflection(null); baseline.current = ""; changeBody(""); setLinks([]); setConflict(null); setRemoveOpen(false); setStatus("Reflection removed."); }
      catch (reason) { setRemoveError(reason instanceof ReflectionConflictError ? "The saved reflection changed. Keep it and review the latest version before removing it." : "Could not remove the reflection. Your writing is still here."); }
      finally { lock.current = false; setBusy(false); }
    }}>Remove reflection</button><button data-initial-focus disabled={busy} onClick={() => setRemoveOpen(false)}>Keep reflection</button></div></JournalDialog> : null}
  </main>;
}
