import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { CategoryRepository, PersonRepository } from "../data/repositories/prayer-metadata";
import { ReflectionRepository } from "../data/repositories/reflections";
import { assertLocalDate, todayLocalDate } from "../domain/time";
import type { Category, LocalDate, Person, Prayer, Reflection, ScriptureLink, ScriptureReference } from "../domain/types";
import { parsePendingScripture } from "../reflection/context";
import { JournalHeading, WritingPreview } from "../writing/JournalPrimitives";
import { ScriptureContext } from "../writing/ScriptureContext";
import { useWritingGuard } from "../writing/useWritingGuard";
import { blankPrayerAdministration, PrayerAdministrationFields, type PrayerAdministrationValue } from "./PrayerAdministrationFields";
import { useDurableDraft } from "../recovery/useDurableDraft";
import { DraftProtection, DraftRecovery } from "../recovery/DraftRecovery";
import { saveJournalDraft } from "../recovery/editor-adapters";
import type { DraftPayload, RecordBaseline } from "../recovery/types";
import { isDraftReturnRoute } from "../recovery/validation";
import { parsePlanReadingLocator } from "../mcheyne/context";

const reflections = new ReflectionRepository(db);
const peopleRepository = new PersonRepository(db);
const categoriesRepository = new CategoryRepository(db);
function uniqueReferences(items: ScriptureReference[]): ScriptureReference[] {
  const seen = new Set<string>();
  return items.filter(item => { const key = `${item.translationId}|${item.startVerseKey}|${item.endVerseKey}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
export function NewPrayerScreen() {
  const location = useLocation();
  return <PrayerCapture key={location.pathname + location.search} />;
}
function PrayerCapture() {
  const navigate = useNavigate(); const location = useLocation(); const [params] = useSearchParams();
  const [recoveredSource, setRecoveredSource] = useState<RecordBaseline | null | undefined>();
  const [recoveredSourceRequest, setRecoveredSourceRequest] = useState<{ id: string | null } | null>(null);
  const sourceReflectionId = recoveredSource === undefined ? params.get("sourceReflectionId") : recoveredSource?.id ?? recoveredSourceRequest?.id ?? null;
  const [recoveredReferences, setRecoveredReferences] = useState<ScriptureReference[] | null>(null);
  const [recoveredDate, setRecoveredDate] = useState<LocalDate | null>(null);
  const [recoveredReturn, setRecoveredReturn] = useState<string | null>(null);
  const [omitReferences, setOmitReferences] = useState(false), [edited, setEdited] = useState(false);
  const [pendingDismissed, setPendingDismissed] = useState(false);
  const pending = useMemo(() => pendingDismissed ? null : parsePendingScripture(params), [params, pendingDismissed]);
  const selfParams = new URLSearchParams(location.search); if (recoveredReturn) selfParams.set("return", recoveredReturn);
  const self = location.pathname + (selfParams.size ? `?${selfParams}` : "");
  const [sourceReflection, setSourceReflection] = useState<Reflection | null>(null);
  const [sourceLinks, setSourceLinks] = useState<ScriptureLink[]>([]);
  const [people, setPeople] = useState<Person[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [body, setBody] = useState(""); const [detailsOpen, setDetailsOpen] = useState(false);
  const bodyRef = useRef(""); const changeBody = (text: string) => { bodyRef.current = text; setBody(text); };
  const [administration, setAdministration] = useState<PrayerAdministrationValue>(() => blankPrayerAdministration());
  const initialAdministration = useRef(administration);
  const administrationRef = useRef(administration); administrationRef.current = administration;
  const committedAdministration = useRef<PrayerAdministrationValue | null>(null);
  const [status, setStatus] = useState(""); const [sourceLoading, setSourceLoading] = useState(Boolean(sourceReflectionId));
  const [sourceError, setSourceError] = useState(""); const [metadataError, setMetadataError] = useState("");
  const [sourceAttempt, setSourceAttempt] = useState(0); const [metadataAttempt, setMetadataAttempt] = useState(0);
  const [omitSource, setOmitSource] = useState(false);
  const saving = useRef(false); const [busy, setBusy] = useState(false);
  const saved = useRef<Prayer | null>(null); const [savedFlag, setSavedFlag] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [initiatedDate] = useState<LocalDate>(() => { const date = params.get("sourceDevotionDate"); if (date) { try { assertLocalDate(date); return date; } catch { /* old/invalid links use the capture date */ } } return todayLocalDate(); });

  useEffect(() => {
    let cancelled = false; setMetadataError("");
    // Capture is read-only until Save. Categories.list() seeds defaults and is
    // reserved for the existing category-management workflow.
    void Promise.allSettled([peopleRepository.list(), categoriesRepository.listActive().then(items => items.sort((a,b) => a.sortOrder-b.sortOrder || a.name.localeCompare(b.name)))]).then(([nextPeople, nextCategories]) => {
      if (cancelled) return;
      if (nextPeople.status === "fulfilled") setPeople(nextPeople.value);
      if (nextCategories.status === "fulfilled") setCategories(nextCategories.value);
      if (nextPeople.status === "rejected" || nextCategories.status === "rejected") setMetadataError("Some people or categories could not load. You can still save a request without them.");
    });
    return () => { cancelled = true; };
  }, [metadataAttempt]);
  useEffect(() => {
    let cancelled = false;
    if (!sourceReflectionId || omitSource) { setSourceLoading(false); return; }
    setSourceLoading(true); setSourceError("");
    void (async () => {
      const reflection = await reflections.getById(sourceReflectionId);
      if (!reflection) throw new Error("This source reflection is no longer available.");
      const links = await reflections.listScriptureLinks(reflection.id);
      if (!cancelled) { setSourceReflection(reflection); setSourceLinks(links); }
      if (!cancelled && recoveredSource && recoveredSource.revision !== reflection.revision) setSourceError("The source reflection changed since this draft was kept. Review its current writing before using it, or continue without the reflection.");
      if (!cancelled && recoveredSourceRequest) setSourceError("The original source had not finished loading when this draft was kept. Review its writing before using it, or continue without the reflection.");
    })().catch(reason => { if (!cancelled) setSourceError(reason instanceof Error ? reason.message : "Could not load the source reflection."); })
      .finally(() => { if (!cancelled) setSourceLoading(false); });
    return () => { cancelled = true; };
  }, [sourceReflectionId, recoveredSource?.revision, recoveredSourceRequest, sourceAttempt, omitSource]);

  const references = recoveredReferences ?? uniqueReferences([...(omitSource ? [] : sourceLinks.map(({ translationId, startVerseKey, endVerseKey }) => ({ translationId, startVerseKey, endVerseKey }))), ...(pending ? [pending] : [])]);
  const returnParam = recoveredReturn ?? params.get("return");
  const back = isDraftReturnRoute(returnParam) ? returnParam : sourceReflection ? `/today/reflection/${sourceReflection.localDate}` : "/prayer";
  const dirty = savedFlag ? body !== saved.current?.body || JSON.stringify(administration) !== JSON.stringify(committedAdministration.current) : Boolean(body) || references.length > 0 || omitSource || omitReferences || pendingDismissed || JSON.stringify(administration) !== JSON.stringify(initialAdministration.current);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const draftPayload: Extract<DraftPayload, { kind: "prayer-create" }> = { kind: "prayer-create", body, administration, localDate: recoveredDate ?? (sourceReflection && !omitSource ? sourceReflection.localDate : initiatedDate), sourceReflection: recoveredSource === undefined ? sourceReflection ? { id: sourceReflection.id, revision: sourceReflection.revision } : null : recoveredSource, references, omitSource, omitReferences };
  if (recoveredSourceRequest) draftPayload.sourceRequest = recoveredSourceRequest;
  else if (!omitSource && sourceReflectionId && !sourceReflection) draftPayload.sourceRequest = { id: /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(sourceReflectionId) ? sourceReflectionId : null };
  const reading = parsePlanReadingLocator(new URLSearchParams(back.split("?")[1]));
  const recovery = useDurableDraft(db, { returnTo: back, reading: reading ? { enrollmentId: reading.enrollmentId, assignmentSequence: reading.sequence, readingIndex: reading.readingIndex } : null }, edited && dirty ? draftPayload : null, edited && dirty);
  const canSave = Boolean(body.trim()) && !sourceLoading && (!sourceError || omitSource);
  const create = async (): Promise<Prayer> => {
    if (saved.current) { if (dirtyRef.current) throw new Error("The prayer was already saved. Copy your newer writing before leaving; do not create it again."); return saved.current; }
    if (saving.current) throw new Error("A save is already in progress.");
    if (!canSave) throw new Error("Write a request and resolve its source before saving.");
    saving.current = true; setBusy(true); setStatus("");
    const submittedBody = bodyRef.current, submittedAdministration = structuredClone(administrationRef.current);
    try {
      // Source disappearance is checked again by the repository inside creation.
      recovery.controller.stage({ ...draftPayload, body: submittedBody, administration: submittedAdministration });
      const result = await recovery.controller.commit(context => saveJournalDraft(db, context));
      const prayer = result.prayer;
      if (!prayer) throw new Error("The prayer was recorded. Reopen the saved record to refresh; do not repeat creation.");
      saved.current = prayer;
      committedAdministration.current = submittedAdministration;
      const newer = bodyRef.current !== submittedBody || JSON.stringify(administrationRef.current) !== JSON.stringify(submittedAdministration) || result.newerWriting;
      if (alive.current) { setSavedFlag(true); if (!newer) changeBody(prayer.body); setStatus(newer ? "Prayer saved locally. Newer writing is kept for copying; it has not changed the saved request." : "Prayer saved locally."); }
      if (newer) throw new Error("Prayer saved locally. Copy your newer writing before leaving; it has not changed the saved request.");
      return prayer;
    } catch (reason) { if (alive.current) { setStatus(reason instanceof Error ? reason.message : "Could not save. Your request is still here."); if (reason instanceof Error && reason.message.startsWith("The source reflection")) setSourceError(reason.message); } throw reason; }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  const guard = useWritingGuard(dirty, async () => { await recovery.controller.flush().catch(() => undefined); await create(); }, canSave && !savedFlag, target => {
    const url = new URL(target, "https://mdd.invalid");
    if (saved.current && url.searchParams.get("return") === self) {
      url.searchParams.set("return", `/prayer/${saved.current.id}?${new URLSearchParams({ return: back })}`);
      return url.pathname + url.search;
    }
    return target;
  }, async () => {
    await recovery.controller.discard();
    changeBody(saved.current?.body ?? ""); setAdministration(committedAdministration.current ?? initialAdministration.current); setPendingDismissed(true); setRecoveredReferences([]); setEdited(false);
    setOmitSource(true); setSourceReflection(null); setSourceLinks([]); setStatus("");
  });
  const saveAndOpen = async () => {
    try { const prayer = await create(); if (!alive.current) return; guard.allowNavigation(); navigate(`/prayer/${prayer.id}?${new URLSearchParams({ return: back })}`, { replace: true }); }
    catch { /* keep editor and show actionable status */ }
  };
  return <main className="journal-workspace journal-prayer mg-prayer-capture-workspace">
    <JournalHeading title="Add prayer" subtitle="Bring it to Him" back={back} />
    <DraftRecovery controller={recovery.controller} kind="prayer-create" current={draftPayload} returnTo={self} ready={!sourceLoading} canRecover={!busy && !savedFlag && (!edited || !dirty)} adopt={(payload, source) => {
      if (payload.kind !== "prayer-create") return;
      changeBody(payload.body); setAdministration(payload.administration); administrationRef.current = payload.administration;
      setRecoveredSource(payload.sourceReflection); setRecoveredReferences(payload.references); setRecoveredDate(payload.localDate); setRecoveredReturn(source.metadata.context.returnTo);
      setRecoveredSourceRequest(payload.sourceRequest ?? null);
      if (payload.sourceRequest && !payload.sourceRequest.id && !payload.omitSource) setSourceError("The original source could not be resolved. Return to its context or choose to continue without the reflection.");
      setOmitSource(payload.omitSource); setOmitReferences(payload.omitReferences); setPendingDismissed(true); setEdited(true);
      setStatus("Draft recovered on this device. No prayer has been saved.");
    }} />
    {sourceLoading ? <p role="status">Opening your reflection…</p> : sourceError && !omitSource ? <section className="journal-notice" role="alert"><p>{sourceError}</p><div className="journal-actions"><button onClick={() => setSourceAttempt(value => value + 1)}>Retry source</button>{sourceReflection && (recoveredSource || recoveredSourceRequest) ? <button onClick={() => { setRecoveredSource({ id: sourceReflection.id, revision: sourceReflection.revision }); setRecoveredSourceRequest(null); setRecoveredDate(sourceReflection.localDate); setSourceError(""); setEdited(true); }}>Use reviewed reflection</button> : null}<button onClick={() => { setOmitSource(true); setSourceReflection(null); setSourceLinks([]); setEdited(true); }}>Continue without reflection</button></div></section> : null}
    {(sourceReflection && !omitSource || (!omitReferences && references.length > 0)) ? <details className="journal-context"><summary>{sourceReflection && !omitSource ? "From your reflection" : "From Scripture"}<span>{sourceReflection && !omitSource ? sourceReflection.localDate : "Linked passages"}</span></summary>
      {sourceReflection && !omitSource ? <WritingPreview text={sourceReflection.bodyMd} /> : null}
      {!omitReferences && references.map(reference => <ScriptureContext key={`${reference.startVerseKey}|${reference.endVerseKey}`} reference={reference} returnTo={self} pending />)}
    </details> : null}
    <section className="journal-paper journal-capture" aria-label="Prayer request">
      <label htmlFor="prayer-body">What do you want to pray about?</label>
      <textarea id="prayer-body" className="journal-textarea" readOnly={busy || savedFlag} value={body} onChange={event => { changeBody(event.target.value); setEdited(true); setStatus(""); }} onCompositionEnd={event => { changeBody(event.currentTarget.value); setEdited(true); recovery.controller.stage({ ...draftPayload, body: event.currentTarget.value }); void recovery.controller.flush().catch(() => undefined); }} placeholder="Name what is on your heart." />
      <div className="journal-tools"><button disabled={busy || savedFlag} aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>{detailsOpen ? "Hide details" : "Add details"}</button><span className="save-state">{busy ? "Saving…" : savedFlag ? "Saved locally" : dirty ? "Unsaved changes" : "Not saved yet"}</span></div>
      {detailsOpen ? <div className="journal-details">{metadataError ? <p className="journal-notice">{metadataError}<button onClick={() => setMetadataAttempt(value => value + 1)}>Retry details</button></p> : null}
        <fieldset disabled={busy || savedFlag}><PrayerAdministrationFields value={administration} people={people} categories={categories} onChange={value => { administrationRef.current = value; setAdministration(value); setEdited(true); }} /></fieldset>
        <div className="journal-actions"><Link to={`/prayer/people?${new URLSearchParams({ return: self })}`}>Manage people</Link><Link to={`/prayer/categories?${new URLSearchParams({ return: self })}`}>Manage categories</Link></div>
      </div> : null}
    </section>
    <DraftProtection controller={recovery.controller} />
    <p className="journal-status prayer-form-status" aria-live="polite">{status}</p>
    <div className="journal-actions"><button className="grace-primary" disabled={busy || savedFlag || !canSave} onClick={() => void saveAndOpen()}>Save prayer</button>{saved.current ? <Link to={`/prayer/${saved.current.id}?${new URLSearchParams({ return: back })}`}>Open saved prayer</Link> : <Link to={back}>Cancel</Link>}</div>
    <p className="journal-help">Kept drafts can be recovered on this device. Save to record your prayer. The latest edits may not be kept yet; drafts do not replace external backups.</p>
    {guard.dialog}
  </main>;
}
