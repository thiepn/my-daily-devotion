import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { db } from "../data/database";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import type { ScriptureReference } from "../domain/types";
import { usePrayerRead } from "../prayer/detail-hooks";
import { usePrayerDraftGuard } from "../prayer/usePrayerDraftGuard";
import { JournalDialog } from "../writing/JournalPrimitives";
import { useDurableDraft } from "../recovery/useDurableDraft";
import { DraftProtection, DraftRecovery } from "../recovery/DraftRecovery";
import { saveJournalDraft } from "../recovery/editor-adapters";
import { draftTargetKey } from "../recovery/validation";
import type { DraftPayload } from "../recovery/types";
import { parsePlanReadingLocator } from "../mcheyne/context";

const notes = new VerseNoteRepository(db);
type NotePayload = Extract<DraftPayload, { kind: "verse-note" }>;
export interface VerseNoteEditorHandle { request: (action: () => void) => void }
export function VerseNoteEditor({ reference, label, returnTo, onClose, onChanged, ref }: {
  reference: ScriptureReference; label: string; returnTo: string; onClose: () => void; onChanged: () => void; ref: Ref<VerseNoteEditorHandle>;
}) {
  const key = `${reference.translationId}:${reference.startVerseKey}:${reference.endVerseKey}`;
  const load = usePrayerRead(key, async () => ({ note: await notes.getSavedRecord(reference) }));
  const [body, setBody] = useState(""), [initial, setInitial] = useState(""), [edited, setEdited] = useState(false);
  const [baseline, setBaseline] = useState<NotePayload["baseline"]>(null), [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [conflict, setConflict] = useState(false), [confirmRemove, setConfirmRemove] = useState(false);
  const bodyRef = useRef(body); bodyRef.current = body;
  const acting = useRef(false), alive = useRef(true), explicitRemovedBaseline = useRef<{ id: string; revision: number } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const dirty = edited && body !== initial;
  const payload: NotePayload = { kind: "verse-note", reference, bodyMd: body, baseline };
  const reading = parsePlanReadingLocator(new URLSearchParams(returnTo.split("?")[1]));
  const recovery = useDurableDraft(db, { returnTo, reading: reading ? { enrollmentId: reading.enrollmentId, assignmentSequence: reading.sequence, readingIndex: reading.readingIndex } : null }, dirty ? payload : null, dirty);
  useEffect(() => {
    if (load.error && !ready) return;
    const current = load.data?.note;
    if (!ready) {
      return;
    }
    if (dirty && baseline && (!current || current.id !== baseline.id || current.revision !== baseline.revision)) setConflict(true);
    if (!dirty && !acting.current && current && !current.deletedAt && (baseline?.id !== current.id || baseline.revision !== current.revision)) {
      setBaseline({ id: current.id, revision: current.revision, bodyMd: current.bodyMd });
      setBody(current.bodyMd); bodyRef.current = current.bodyMd; setInitial(current.bodyMd); setEdited(false); setConflict(false);
    }
  }, [load.data, load.error, ready, dirty, baseline]);
  useEffect(() => {
    if (ready || load.data === undefined) return;
      const current = load.data.note;
      const text = current && !current.deletedAt ? current.bodyMd : "";
      if (current?.deletedAt) explicitRemovedBaseline.current = { id: current.id, revision: current.revision };
      setBaseline(current ? { id: current.id, revision: current.revision, bodyMd: current.bodyMd } : null);
      setBody(text); bodyRef.current = text; setInitial(text); setReady(true);
  }, [ready, load.data]);
  const current = load.data?.note;
  const removed = Boolean(ready && baseline && load.data && !current || current?.deletedAt && !(explicitRemovedBaseline.current?.id === current.id && explicitRemovedBaseline.current.revision === current.revision && baseline?.revision === current.revision));
  const save = async () => {
    if (acting.current) throw new Error("A note action is already in progress.");
    if (!ready || removed || conflict || !bodyRef.current.trim()) throw new Error("Review the note before saving. Your writing stays here.");
    acting.current = true; setBusy(true); setMessage(""); const submitted = bodyRef.current;
    try {
      recovery.controller.stage({ ...payload, bodyMd: submitted });
      const result = await recovery.controller.commit(context => saveJournalDraft(db, context), (latest, saved, committed) => {
        if (latest.kind !== "verse-note" || saved.kind !== "verse-note") throw new Error("Wrong note editor.");
        return { ...latest, baseline: { ...committed.marker.records[0]!, bodyMd: saved.bodyMd.replace(/\r\n/g, "\n").trimEnd() } };
      });
      const note = result.verseNote;
      if (!note) throw new Error("The note was recorded. Reopen its saved record; do not repeat this action.");
      if (alive.current) {
        setBaseline({ id: note.id, revision: note.revision, bodyMd: note.bodyMd }); setInitial(note.bodyMd); setConflict(false);
        load.accept(() => ({ note })); onChanged();
        if (bodyRef.current !== submitted || result.newerWriting) { setMessage("Earlier note saved locally. Newer writing remains unsaved."); throw new Error("Earlier note saved locally. Keep the newer writing before continuing."); }
        bodyRef.current = note.bodyMd; setBody(note.bodyMd); setEdited(false); setMessage("Verse note saved locally.");
      }
    } catch (reason) { if (alive.current) { setMessage(reason instanceof Error ? reason.message : "Could not save. Your note is still here."); if (reason instanceof Error && /changed|removed/.test(reason.message)) { setConflict(true); load.retry(); } } throw reason; }
    finally { acting.current = false; if (alive.current) setBusy(false); }
  };
  const discard = async () => { await recovery.controller.discard(); bodyRef.current = initial; setBody(initial); setEdited(false); setConflict(false); setMessage(""); };
  const useSavedVersion = async () => {
    if (!current || current.deletedAt || acting.current) return;
    acting.current = true; setBusy(true); setMessage("");
    try { await recovery.controller.discard(); setBody(current.bodyMd); bodyRef.current = current.bodyMd; setInitial(current.bodyMd); setBaseline({ id: current.id, revision: current.revision, bodyMd: current.bodyMd }); setEdited(false); setConflict(false); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not discard. Keep your writing open."); }
    finally { acting.current = false; if (alive.current) setBusy(false); }
  };
  const guard = usePrayerDraftGuard({ dirty, save, discard, pending: busy, canSave: ready && !removed && !conflict && Boolean(body.trim()) });
  useImperativeHandle(ref, () => ({ request: guard.request }));
  const remove = async () => {
    if (acting.current || !baseline) return; acting.current = true; setBusy(true); setMessage("");
    try {
      await recovery.controller.discard({ tables: ["verseNotes"], action: () => notes.remove(reference, baseline.revision, baseline.id) });
      if (alive.current) { onChanged(); onClose(); }
    } catch (reason) { if (alive.current) setMessage(reason instanceof Error ? reason.message : "Could not remove this note."); }
    finally { acting.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="verse-note-editor" aria-label="Verse note editor">
    {!ready ? <><p role={load.error ? "alert" : "status"}>{load.error || "Opening verse note…"}</p>{load.error ? <button onClick={load.retry}>Retry note</button> : null}<button onClick={onClose}>Close</button></> : <>
      <DraftRecovery controller={recovery.controller} kind="verse-note" targetKey={draftTargetKey(payload, "")} current={payload} returnTo={returnTo} canRecover={!dirty && !busy && !removed} validateRecovery={async source => {
        const value = source.contents.payload; if (value.kind !== "verse-note") throw new Error("Wrong editor.");
        const saved = await notes.getSavedRecord(value.reference);
        if (saved?.deletedAt || value.baseline && (!saved || saved.id !== value.baseline.id)) throw new Error("This note was removed. Copy your kept writing without recreating it.");
      }} adopt={value => {
        if (value.kind !== "verse-note") return;
        setBaseline(value.baseline); setBody(value.bodyMd); bodyRef.current = value.bodyMd; setEdited(true);
        setConflict(value.baseline ? !current || current.id !== value.baseline.id || current.revision !== value.baseline.revision : Boolean(current));
        setMessage("Draft recovered on this device. No verse note has been saved.");
      }} />
      {removed ? <p className="journal-notice">This saved note was removed. Your writing remains available to copy; it will not recreate the note.</p> : null}
      {load.error ? <p role="alert">{load.error}<button onClick={load.retry}>Retry note refresh</button></p> : null}
      <label htmlFor="reader-verse-note">A note on {label}</label>
      <textarea id="reader-verse-note" value={body} readOnly={busy} onChange={event => { bodyRef.current = event.target.value; setBody(event.target.value); setEdited(true); }} onCompositionEnd={event => { bodyRef.current = event.currentTarget.value; setBody(event.currentTarget.value); setEdited(true); if (event.currentTarget.value !== initial) { recovery.controller.stage({ ...payload, bodyMd: event.currentTarget.value }); void recovery.controller.flush().catch(() => undefined); } }} placeholder="What do you want to remember?" aria-label="Verse note" />
      {conflict ? <section className="journal-conflict" aria-label="Verse note conflict"><h3>Review both versions</h3><label>Your changes<textarea aria-label="Your changes" value={body} readOnly /></label><label>Saved version<textarea aria-label="Saved version" value={current && !current.deletedAt ? current.bodyMd : "Note unavailable"} readOnly /></label><button disabled={busy || !current || Boolean(current.deletedAt)} onClick={() => { if (!current || current.deletedAt) return; setBaseline({ id: current.id, revision: current.revision, bodyMd: current.bodyMd }); setInitial(current.bodyMd); setConflict(false); }}>Keep my writing for the next save</button><button disabled={busy || !current || Boolean(current.deletedAt)} onClick={() => void useSavedVersion()}>Use saved version</button></section> : null}
      <DraftProtection controller={recovery.controller} />
      <p className="reader-status" role="status">{message}</p>
      <div className="verse-note-editor-actions"><button disabled={busy || !dirty || removed || conflict || !body.trim()} onClick={() => void save().catch(() => undefined)}>Save note</button>{current && !current.deletedAt ? <button disabled={busy} onClick={() => setConfirmRemove(true)}>Remove note</button> : null}<button disabled={busy} onClick={() => guard.request(onClose)}>Close</button></div>
    </>}
    {confirmRemove ? <JournalDialog title="Remove this verse note?" close={() => setConfirmRemove(false)} busy={busy}><p>This removes the note and this editor’s unfinished changes from current views. Existing backups are unaffected.</p>{message ? <p role="alert">{message}</p> : null}<div className="journal-dialog-actions"><button disabled={busy} onClick={() => void remove()}>Remove note</button><button data-initial-focus disabled={busy} onClick={() => setConfirmRemove(false)}>Keep note</button></div></JournalDialog> : null}
    {guard.dialog}
  </section>;
}
