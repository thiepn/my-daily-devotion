import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../data/database";
import { CategoryRepository, PersonRepository } from "../data/repositories/prayer-metadata";
import { PrayerRepository } from "../data/repositories/prayers";
import { ReflectionRepository } from "../data/repositories/reflections";
import { assertLocalDate, todayLocalDate } from "../domain/time";
import type { Category, LocalDate, Person, Prayer, Reflection, ScriptureLink, ScriptureReference } from "../domain/types";
import { parsePendingScripture } from "../reflection/context";
import { JournalHeading, WritingPreview } from "../writing/JournalPrimitives";
import { ScriptureContext } from "../writing/ScriptureContext";
import { useWritingGuard } from "../writing/useWritingGuard";
import { administrationInputFromValue, blankPrayerAdministration, PrayerAdministrationFields, type PrayerAdministrationValue } from "./PrayerAdministrationFields";

const prayers = new PrayerRepository(db);
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
  const sourceReflectionId = params.get("sourceReflectionId");
  const pending = useMemo(() => parsePendingScripture(params), [params]);
  const self = location.pathname + location.search;
  const [sourceReflection, setSourceReflection] = useState<Reflection | null>(null);
  const [sourceLinks, setSourceLinks] = useState<ScriptureLink[]>([]);
  const [people, setPeople] = useState<Person[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [body, setBody] = useState(""); const [detailsOpen, setDetailsOpen] = useState(false);
  const [administration, setAdministration] = useState<PrayerAdministrationValue>(() => blankPrayerAdministration());
  const initialAdministration = useRef(JSON.stringify(administration));
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
    })().catch(reason => { if (!cancelled) setSourceError(reason instanceof Error ? reason.message : "Could not load the source reflection."); })
      .finally(() => { if (!cancelled) setSourceLoading(false); });
    return () => { cancelled = true; };
  }, [sourceReflectionId, sourceAttempt, omitSource]);

  const references = uniqueReferences([...(omitSource ? [] : sourceLinks.map(({ translationId, startVerseKey, endVerseKey }) => ({ translationId, startVerseKey, endVerseKey }))), ...(pending ? [pending] : [])]);
  const returnParam = params.get("return");
  const back = returnParam?.startsWith("/") && !returnParam.startsWith("//") ? returnParam : sourceReflection ? `/today/reflection/${sourceReflection.localDate}` : "/prayer";
  const canSave = Boolean(body.trim()) && !sourceLoading && (!sourceError || omitSource);
  const create = async (): Promise<Prayer> => {
    if (saved.current) return saved.current;
    if (saving.current) throw new Error("A save is already in progress.");
    if (!canSave) throw new Error("Write a request and resolve its source before saving.");
    saving.current = true; setBusy(true); setStatus("");
    try {
      // Source disappearance is checked again by the repository inside creation.
      const prayer = await prayers.createPrayer({
        body, sourceReflectionId: omitSource ? null : sourceReflection?.id ?? null,
        ...(!omitSource && sourceReflection ? { expectedSourceReflectionRevision: sourceReflection.revision } : {}),
        sourceDevotionDate: sourceReflection && !omitSource ? sourceReflection.localDate : pending ? initiatedDate : null,
        scriptureReferences: references, ...administrationInputFromValue(administration),
      });
      saved.current = prayer;
      if (alive.current) { setSavedFlag(true); setStatus("Prayer saved locally."); }
      return prayer;
    } catch (reason) { if (alive.current) { setStatus(reason instanceof Error ? reason.message : "Could not save. Your request is still here."); if (reason instanceof Error && reason.message.startsWith("The source reflection")) setSourceError(reason.message); } throw reason; }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  const dirty = !savedFlag && (Boolean(body) || references.length > 0 || JSON.stringify(administration) !== initialAdministration.current);
  const guard = useWritingGuard(dirty, async () => { await create(); }, canSave, target => {
    const url = new URL(target, "https://mdd.invalid");
    if (saved.current && url.searchParams.get("return") === self) {
      url.searchParams.set("return", `/prayer/${saved.current.id}?${new URLSearchParams({ return: back })}`);
      return url.pathname + url.search;
    }
    return target;
  });
  const saveAndOpen = async () => {
    try { const prayer = await create(); if (!alive.current) return; guard.allowNavigation(); navigate(`/prayer/${prayer.id}?${new URLSearchParams({ return: back })}`, { replace: true }); }
    catch { /* keep editor and show actionable status */ }
  };
  return <main className="journal-workspace journal-prayer mg-prayer-capture-workspace">
    <JournalHeading title="Add prayer" subtitle="Bring it to Him" back={back} />
    {sourceLoading ? <p role="status">Opening your reflection…</p> : sourceError && !omitSource ? <section className="journal-notice" role="alert"><p>{sourceError}</p><div className="journal-actions"><button onClick={() => setSourceAttempt(value => value + 1)}>Retry source</button><button onClick={() => { setOmitSource(true); setSourceReflection(null); setSourceLinks([]); }}>Continue without reflection</button></div></section> : null}
    {(sourceReflection && !omitSource || references.length > 0) ? <details className="journal-context"><summary>{sourceReflection && !omitSource ? "From your reflection" : "From Scripture"}<span>{sourceReflection && !omitSource ? sourceReflection.localDate : "Linked passages"}</span></summary>
      {sourceReflection && !omitSource ? <WritingPreview text={sourceReflection.bodyMd} /> : null}
      {references.map(reference => <ScriptureContext key={`${reference.startVerseKey}|${reference.endVerseKey}`} reference={reference} returnTo={self} pending />)}
    </details> : null}
    <section className="journal-paper journal-capture" aria-label="Prayer request">
      <label htmlFor="prayer-body">What do you want to pray about?</label>
      <textarea id="prayer-body" className="journal-textarea" disabled={busy || savedFlag} value={body} onChange={event => { setBody(event.target.value); setStatus(""); }} placeholder="Name what is on your heart." />
      <div className="journal-tools"><button disabled={busy || savedFlag} aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}>{detailsOpen ? "Hide details" : "Add details"}</button><span className="save-state">{busy ? "Saving…" : savedFlag ? "Saved locally" : dirty ? "Unsaved changes" : "Not saved yet"}</span></div>
      {detailsOpen ? <div className="journal-details">{metadataError ? <p className="journal-notice">{metadataError}<button onClick={() => setMetadataAttempt(value => value + 1)}>Retry details</button></p> : null}
        <fieldset disabled={busy || savedFlag}><PrayerAdministrationFields value={administration} people={people} categories={categories} onChange={setAdministration} /></fieldset>
        <div className="journal-actions"><Link to={`/prayer/people?${new URLSearchParams({ return: self })}`}>Manage people</Link><Link to={`/prayer/categories?${new URLSearchParams({ return: self })}`}>Manage categories</Link></div>
      </div> : null}
    </section>
    <p className="journal-status prayer-form-status" aria-live="polite">{status}</p>
    <div className="journal-actions"><button className="grace-primary" disabled={busy || !canSave} onClick={() => void saveAndOpen()}>Save prayer</button><Link to={back}>Cancel</Link></div>
    <p className="journal-help">Save to keep your writing on this device. Unsaved changes are lost when the app closes.</p>
    {guard.dialog}
  </main>;
}
