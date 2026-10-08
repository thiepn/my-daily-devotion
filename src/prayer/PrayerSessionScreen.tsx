import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { db } from "../data/database";
import { isEditConflict } from "../data/conflicts";
import { PrayerSessionRepository, type PrayerSessionEntry, type PrayerSessionState } from "../data/repositories/prayer-sessions";
import { useLocalClock } from "../app/useLocalClock";
import { DevotionalIcon } from "../app/visual/DevotionalIcon";
import { MorningGraceArtwork } from "../app/visual/MorningGraceArtwork";
import { JournalDialog, JournalHeading } from "../writing/JournalPrimitives";
import { ScriptureContext } from "../writing/ScriptureContext";
import { personInitials } from "./journal";
import { prayerDetailUrl } from "./detail-model";
import { usePrayerPosition, usePrayerRead } from "./detail-hooks";
import { usePrayerDraftGuard } from "./usePrayerDraftGuard";
import { useSessionState } from "./session-hooks";
import {useDurableDraft} from "../recovery/useDurableDraft";
import {DraftProtection,DraftRecovery} from "../recovery/DraftRecovery";
import {saveFocusedPrayerDraft} from "../recovery/session-adapter";
import {draftTargetKey} from "../recovery/validation";
import {DraftError,type DraftPayload} from "../recovery/types";
import type {LocalDate} from "../domain/types";
import { parsePrayerSessionContext, prayerSessionUrl, readSessionPerson, readSessionRequestContext, sessionPresentation, sessionReason, type PrayerSessionContext } from "./session-context";

const repository = new PrayerSessionRepository(db);
const pendingCreationReasons = new Map<string, Record<string, string>>();
const dateLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(`${value}T12:00:00`));
const instantLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
type AnswerDraft = { itemId: string; prayerId:string; localDate:LocalDate; revision: number; request: string; body: string; committed: boolean };

function SessionFrame({ returnTo, children }: { returnTo: string; children: ReactNode }) {
  return <main className="journal-workspace session-journal"><JournalHeading title="Focused prayer" subtitle="A quiet moment with God" back={returnTo}/>{children}</main>;
}

export function PrayerSessionScreen() {
  const location = useLocation();
  const context = parsePrayerSessionContext(location.search);
  if (context.invalidSession) return <SessionFrame returnTo={context.returnTo}><div className="session-state"><h2>Session unavailable</h2><p>This session link is not valid. Your saved requests are unchanged.</p><Link to={context.returnTo}>Return to Prayer</Link></div></SessionFrame>;
  if (!context.sessionId) return <SessionStart key={`${context.depth}|${context.returnTo}`} context={context}/>;
  return <SessionJournal key={context.sessionId} id={context.sessionId} returnTo={context.returnTo} draftId={context.draftId} reasons={pendingCreationReasons.get(context.sessionId)}/>;
}

function SessionStart({ context }: { context: PrayerSessionContext }) {
  const navigate = useNavigate(), { localDate } = useLocalClock();
  const [initiatedDate] = useState(localDate);
  const [error, setError] = useState(""), [empty, setEmpty] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setError(""); setEmpty(false);
    void repository.startOrResume(context.depth, initiatedDate).then(state => {
      if (!active) return;
      if (!state) { setEmpty(true); return; }
      if (state.reasons) pendingCreationReasons.set(state.session.id, state.reasons);
      navigate(prayerSessionUrl({ sessionId: state.session.id, returnTo: context.returnTo }), { replace: true });
    }).catch(() => { if (active) setError("Could not prepare your session. Please try again."); });
    return () => { active = false; };
  }, [context.depth, context.returnTo, initiatedDate, attempt, navigate]);
  return <SessionFrame returnTo={context.returnTo}>
    {error ? <div className="journal-notice" role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Retry</button></div>
      : empty ? <div className="session-state"><h2>A moment for prayer</h2><p>No active requests are eligible for an automatic session today. Manual-only requests remain in your Prayer list.</p><Link to={context.returnTo}>Return to Prayer</Link></div>
      : <p role="status">Preparing your saved requests…</p>}
  </SessionFrame>;
}

function SessionJournal({ id, returnTo, reasons, draftId }: { id: string; returnTo: string; reasons: Record<string, string> | undefined; draftId:string|null }) {
  const location = useLocation(), navigate = useNavigate(), { localDate } = useLocalClock();
  const load = useSessionState(id,Boolean(draftId)), state = load.data;
  const view = state ? sessionPresentation(state) : null;
  const current = view?.current ?? null, prayer = current?.prayer ?? null;
  const url = prayerSessionUrl({ sessionId: id, returnTo, draftId });
  const context = usePrayerRead(`session-context:${prayer?.id ?? "none"}`, () => prayer ? readSessionRequestContext(db, prayer.id) : Promise.resolve(null));
  const person = usePrayerRead(`session-person:${prayer?.id ?? "none"}`, () => prayer ? readSessionPerson(db, prayer.id) : Promise.resolve(null));
  const [draft, setDraft] = useState<AnswerDraft | null>(null), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""), [endOpen, setEndOpen] = useState(false), [updateExpanded, setUpdateExpanded] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [draftOwner,setDraftOwner]=useState(0);
  const requestedDraft=useRef("");
  const [creationReasons] = useState(reasons);
  const draftRef = useRef(draft); draftRef.current = draft;
  const acting = useRef(false), previousItem = useRef<string | null>(null), answerInput = useRef<HTMLTextAreaElement>(null);
  const payload:Extract<DraftPayload,{kind:"prayer-answer"}>|null=draft?{kind:"prayer-answer",body:draft.body,baseline:{id:draft.prayerId,revision:draft.revision,status:"ACTIVE",body:draft.request},session:{id,itemId:draft.itemId,localDate:draft.localDate}}:null;
  const durable=useDurableDraft(db,{returnTo:url,reading:null},draft?.body!==""?payload:null,Boolean(draft&&draft.body!==""),String(draftOwner));
  const discard = async () => { await durable.controller.discard();draftRef.current = null; setDraft(null); setConflict(false); };
  const guard = usePrayerDraftGuard({ dirty: Boolean(draft), save: async () => {}, discard, answer: true, answerRecorded: Boolean(draft?.committed), pending: busy });
  usePrayerPosition(url, state === null || Boolean(state && (state.session.endedAt || !prayer || context.data !== undefined || context.error)), null, ".session-journal");
  useEffect(() => { pendingCreationReasons.delete(id); }, [id]);

  useEffect(() => { if (location.pathname + location.search !== url) navigate(url, { replace: true, state: location.state }); }, [url, location.pathname, location.search, location.state, navigate]);
  useEffect(() => {
    if (previousItem.current && current?.item.id !== previousItem.current && !draft) {
      document.getElementById("session-request")?.focus();
      if (!current) document.getElementById("session-state-heading")?.focus();
    }
    previousItem.current = current?.item.id ?? null;
  }, [current?.item.id, draft]);
  useEffect(() => { setUpdateExpanded(false); }, [current?.item.id]);
  useEffect(() => { if (draft && !draft.committed) answerInput.current?.focus(); }, [draft?.itemId]);
  useEffect(()=>{if(!draftId||requestedDraft.current===draftId||draft||!state||!current?.prayer||state.session.endedAt)return;requestedDraft.current=draftId;const next={itemId:current.item.id,prayerId:current.prayer.id,localDate:state.session.localDate,revision:current.prayer.revision,request:current.prayer.body,body:"",committed:false};draftRef.current=next;setDraft(next);},[draftId,draft,state,current]);

  const perform = async (action: () => Promise<void>) => {
    if (acting.current) return;
    acting.current = true; setBusy(true); setMessage("");
    try { await action(); }
    catch (reason) { setConflict(isEditConflict(reason)||reason instanceof DraftError&&reason.code==="stale"); setMessage(reason instanceof Error ? reason.message : "Could not record this action. Please try again."); }
    finally { acting.current = false; setBusy(false); }
  };
  const continueSession = () => guard.request(() => void perform(async () => {
    load.accept(await repository.loadState(id)); setConflict(false);
  }));
  const act = (kind: "next" | "skip", captured: PrayerSessionEntry, saved: PrayerSessionState) => guard.request(() => void perform(async () => {
    const expected = { session: saved.session.revision, item: captured.item.revision, prayer: captured.prayer!.revision };
    const result = kind === "next" ? await repository.next(id, captured.item.id, undefined, expected) : await repository.skip(id, captured.item.id, undefined, expected);
    load.accept(result.state); setConflict(false);
    setMessage(kind === "next" ? "Prayed action recorded." : "Request skipped. It was not marked prayed.");
  }));
  const saveAnswer = () => void perform(async () => {
    const captured = draftRef.current;
    if (!captured || captured.committed || !state || !payload) return;
    const item = state.entries.find(entry => entry.item.id === captured.itemId);
    if (!item) throw new Error("This request is no longer pending in your session.");
    durable.controller.stage({...payload,body:captured.body});
    const result = await durable.controller.commit(context=>saveFocusedPrayerDraft(db,context));
    if(result.state)load.accept(result.state);else load.retry();setConflict(false);
    if (draftRef.current?.body !== captured.body || result.newerWriting) {
      const remaining = { ...draftRef.current!, committed: true };
      draftRef.current = remaining; setDraft(remaining); setMessage("The answer was recorded. Newer writing is not saved; copy it before continuing.");
    } else { setDraftOwner(value=>value+1);draftRef.current=null;setDraft(null);setMessage("Answer recorded."); }
  });
  const end = () => void perform(async () => {
    if (!state) return;
    const result = await repository.endSession(id, undefined, state.session.revision);
    if (!result) { load.retry(); throw new Error("This session is no longer available."); }
    load.accept(result.state); setEndOpen(false); setMessage("Session ended. Remaining requests were not marked prayed.");
  });

  const anchor = draft ? state?.entries.find(entry => entry.item.id === draft.itemId) : null;
  const detached = Boolean(draft && (draft.committed || !state || state.session.endedAt || !anchor || anchor.item.outcome !== null || !anchor.prayer || anchor.prayer.status !== "ACTIVE"));
  const changed = Boolean(draft && anchor?.prayer && draft.revision !== anchor.prayer.revision);
  const valid = Boolean(state && !state.session.endedAt && current && prayer?.status === "ACTIVE");
  const latest = valid ? context.data?.latest : null;
  const pendingAnswer = draft && !detached;
  const notice = <>{message ? <p className="journal-status" role="status">{message}</p> : null}{load.error ? <div className="journal-notice" role="alert"><p>{load.error}</p><button disabled={busy} onClick={load.retry}>{state === undefined ? "Retry" : "Retry refresh"}</button></div> : null}</>;
  const recovery = detached && draft ? <section className="journal-notice session-retained"><h2>Your unsaved answer note</h2><p>{draft.committed ? "The answer is already recorded. This newer writing has not been saved." : "This request changed or is no longer available for an answer. Your writing is still here to copy."}</p><textarea aria-label="Unsaved answer note" readOnly value={draft.body}/><DraftProtection controller={durable.controller}/><button disabled={busy} onClick={continueSession}>Continue session</button></section> : null;

  return <main className={`journal-workspace session-journal${valid && !detached ? " session-is-active" : ""}`}>
    <header className="journal-heading session-heading">
      <div className="session-heading-top"><Link id="session-pause" className="quiet-back-link" to={returnTo}>{state?.session.endedAt ? "Back" : "Pause and return"}</Link>{view?.position && !detached ? <span>Request {view.position} of {view.total}</span> : null}</div>
      <div className="journal-heading-line"><div><p className="journal-date">{state ? dateLabel(state.session.localDate) : "A quiet moment with God"}</p><h1>Focused prayer</h1></div><MorningGraceArtwork variant="botanical"/></div>
    </header>
    {notice}
    {state && state.session.localDate !== localDate && !state.session.endedAt ? <aside className="session-date-notice"><p>You are continuing your {dateLabel(state.session.localDate)} session. Prayed actions will keep that devotional date.</p><Link id="session-new-day" to={prayerSessionUrl({ depth: state.session.depth, returnTo })}>Start today’s session</Link></aside> : null}
    {recovery}
    {state === undefined ? !load.error && <p role="status">Opening your saved session…</p>
      : !state ? <div className="session-state"><h2 id="session-state-heading" tabIndex={-1}>Session unavailable</h2><p>This session was removed or is no longer available. Your other saved requests are unchanged.</p><Link to={returnTo}>{returnTo.startsWith("/today") ? "Return to Today" : "Return to Prayer"}</Link></div>
      : view?.closed && !detached ? <div className="session-state journal-paper"><MorningGraceArtwork variant="botanical"/><h2 id="session-state-heading" tabIndex={-1}>{view.closed === "finished" ? "Session finished" : "Session ended"}</h2><p>{view.closed === "finished" ? "You can return whenever you are ready to pray again." : "Remaining requests were not marked prayed. They remain in your Prayer list."}</p><Link className="grace-primary" to={/^\/prayer(?:\?|$)/.test(returnTo) ? returnTo : "/prayer"}>Return to Prayer</Link></div>
      : !valid && !detached ? <div className="journal-notice"><h2 id="session-state-heading" tabIndex={-1}>This request has changed</h2><p>It is no longer active or available. Continue to the next available request without recording a prayed action.</p><button className="grace-primary" disabled={busy} onClick={continueSession}>Continue session</button></div>
      : valid && !detached && prayer && current ? <>
        <article className="journal-paper session-request-paper">
          {person.data ? <div className="prayer-record-person"><span className="prayer-record-initials" aria-hidden="true">{personInitials(person.data.name)}</span><div><strong>{person.data.name}</strong>{person.data.relationship ? <small>{person.data.relationship}</small> : null}</div></div> : <p className="session-kicker">Bring it to Him</p>}
          {person.error ? <p className="journal-help">Person details could not load. <button onClick={person.retry}>Retry person</button></p> : null}
          <p id="session-request" tabIndex={-1} className="session-request-text">{prayer.body}</p>
          <p className="session-reason">{sessionReason(creationReasons?.[current.item.id])}</p>
          {latest ? <section className="session-latest"><div><span>Latest {latest.type}</span><time dateTime={latest.occurredAt}>{instantLabel(latest.occurredAt)}</time></div><p>{latest.body.length > 320 && !updateExpanded ? `${latest.body.slice(0, 320)}…` : latest.body}</p>{latest.body.length > 320 ? <button id="session-update-more" aria-expanded={updateExpanded} onClick={() => setUpdateExpanded(value => !value)}>{updateExpanded ? "Read less" : "Read more"}</button> : null}</section> : null}
          {context.error ? <p className="journal-help">Saved context could not load. Your request is still available. <button onClick={context.retry}>Retry context</button></p> : null}
          {context.data?.links.length ? <details className="session-scripture"><summary id="session-scripture-toggle">Linked Scripture <span>{context.data.links.length} {context.data.links.length === 1 ? "passage" : "passages"}</span></summary>{context.data.links.map(link => <ScriptureContext key={link.id} linkId={`session-scripture-${link.id}`} reference={link} returnTo={url}/>)}</details> : null}
        </article>
        {pendingAnswer && draft ? <section className="journal-paper session-answer" aria-labelledby="session-answer-heading">{payload?<DraftRecovery controller={durable.controller} kind="prayer-answer" targetKey={draftTargetKey(payload,"")} current={payload} returnTo={url} canRecover={!draft.body&&!busy&&!changed&&!conflict} validateRecovery={async source=>{const kept=source.contents.payload;if(kept.kind!=="prayer-answer"||!kept.session||kept.session.id!==id||kept.session.itemId!==draft.itemId||kept.baseline.id!==draft.prayerId||kept.session.localDate!==draft.localDate)throw new Error("This note belongs to another request or session. Keep it for copying.");const saved=await repository.readState(id);const pending=saved.entries.find(entry=>entry.item.outcome===null);if(saved.session.endedAt||pending?.item.id!==kept.session.itemId||pending.prayer?.status!=="ACTIVE")throw new Error("This request is no longer pending. Keep your note for copying.");}} adopt={kept=>{if(kept.kind!=="prayer-answer"||!kept.session)return;const next={itemId:kept.session.itemId,prayerId:kept.baseline.id,localDate:kept.session.localDate,revision:kept.baseline.revision,request:kept.baseline.body,body:kept.body,committed:false};draftRef.current=next;setDraft(next);setConflict(kept.baseline.revision!==prayer.revision);setMessage("Draft recovered on this device. No answer has been recorded.");}}/>:null}<div className="prayer-editor-heading"><h2 id="session-answer-heading">Record an answer</h2><span className="save-state" role="status">{busy ? "Saving…" : "Not recorded yet"}</span></div><label htmlFor="session-answer-note">What happened? <span>optional</span></label><textarea ref={answerInput} id="session-answer-note" className="journal-textarea" disabled={busy} value={draft.body} onChange={event => { const next = { ...draft, body: event.target.value }; draftRef.current = next; setDraft(next); }}/>
          <DraftProtection controller={durable.controller}/>
          {changed || conflict ? <div className="journal-notice"><h3>Review the changed request</h3><p>Your answer note is unchanged. Review the saved wording before recording it.</p><details><summary>Compare request wording</summary><h4>Previously opened</h4><p>{draft.request}</p><h4>Saved version</h4><p>{anchor?.prayer?.body}</p></details><button disabled={busy || !anchor?.prayer} onClick={() => { if (!anchor?.prayer) return; const next = { ...draft, revision: anchor.prayer.revision, request: anchor.prayer.body }; draftRef.current = next; setDraft(next); setConflict(false); setMessage(""); }}>Use saved request</button></div> : null}
          <div className="journal-actions"><button className="grace-primary" disabled={busy || changed || conflict} onClick={saveAnswer}>Mark answered</button><button disabled={busy} onClick={() => guard.request(discard)}>Cancel editing</button></div><p className="journal-help">Only Mark answered records an answer. Kept drafts remain unfinished writing on this device.</p>
        </section> : null}
        <div className="session-devotional-actions"><button id="session-prayed" className={draft ? "" : "grace-primary"} disabled={busy} onClick={() => act("next", current, state)}>Prayed · {view?.last ? "Finish" : "Next"}<DevotionalIcon name="arrow"/></button><div className="session-secondary-actions"><button id="session-skip" disabled={busy} onClick={() => act("skip", current, state)}>Skip this request</button><Link id="session-open-prayer" to={prayerDetailUrl(prayer.id, url)}>Open prayer</Link>{!draft ? <button id="session-open-answer" disabled={busy} onClick={() => { const next = { itemId: current.item.id, prayerId:prayer.id,localDate:state.session.localDate,revision: prayer.revision, request: prayer.body, body: "", committed: false }; draftRef.current = next; setDraft(next); setConflict(false); setMessage(""); }}>Mark answered</button> : null}</div></div>
        <details className="session-options"><summary id="session-options-toggle">Session options</summary><p>Pausing keeps this session ready to resume. Ending leaves remaining requests unmarked.</p><button id="session-end" disabled={busy} onClick={() => guard.request(() => setEndOpen(true))}>End session</button></details>
      </> : null}
    {endOpen ? <JournalDialog title="End this session?" close={() => { if (!busy) setEndOpen(false); }} busy={busy}><p>Remaining requests will not be marked prayed. You can begin a new session from Prayer whenever you are ready.</p>{message ? <p role="alert">{message}</p> : null}<div className="journal-dialog-actions"><button disabled={busy} onClick={end}>End session</button><button disabled={busy} data-initial-focus onClick={() => setEndOpen(false)}>Keep praying</button></div></JournalDialog> : null}
    {guard.dialog}
  </main>;
}
