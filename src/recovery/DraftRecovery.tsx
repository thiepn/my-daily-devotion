import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePrayerRead } from "../prayer/detail-hooks";
import { JournalDialog } from "../writing/JournalPrimitives";
import { db } from "../data/database";
import { DurableDraftController } from "./controller";
import { DraftRepository } from "./repository";
import { draftFields, recoveryUrl } from "./presentation";
import type { DraftPayload, DraftSnapshot } from "./types";

const repository = new DraftRepository(db);
function SettingsFields({payload}:{payload:Extract<DraftPayload,{kind:"prayer-settings"}>}){
  const value=payload.administration;
  const metadata=usePrayerRead(`draft-settings-metadata:${value.personId}:${value.categoryId}`,()=>db.transaction("r",db.people,db.categories,async()=>({person:value.personId?await db.people.get(value.personId):null,category:value.categoryId?await db.categories.get(value.categoryId):null})));
  const names={ROTATION:"Normal rotation",DAILY:"Daily",WEEKDAYS:"Selected weekdays",INTERVAL_DAYS:"Every few days",MONTHLY:"Monthly",ON_DATE:"One specific date",MANUAL_ONLY:"Manual only"};
  const rows:[string,string][]=[["Person",value.personId?metadata.data===undefined&&!metadata.error?"Loading…":metadata.data?.person&&!metadata.data.person.deletedAt?metadata.data.person.name:"Unavailable person":"No person"],["Category",value.categoryId?metadata.data===undefined&&!metadata.error?"Loading…":metadata.data?.category&&!metadata.data.category.deletedAt?metadata.data.category.name:"Unavailable category":"No category"],["Schedule",names[value.scheduleMode]]];
  if(value.scheduleMode==="INTERVAL_DAYS")rows.push(["Every",value.intervalDays?value.intervalDays+" days":"Not entered"],["Starting",value.anchorDate||"Not entered"]);
  if(value.scheduleMode==="MONTHLY")rows.push(["Day of month",value.monthlyDay||"Not entered"]);
  if(value.scheduleMode==="ON_DATE")rows.push(["Date",value.onDate||"Not entered"]);
  if(value.scheduleMode==="WEEKDAYS")rows.push(["Weekdays",value.weekdays.map(day=>["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][day]).join(", ")||"None selected"]);
  rows.push(["Event date",value.eventDate||"Not set"],["Focus until",value.focusUntil||"Not set"]);
  return <><dl className="draft-comparison-details">{rows.map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>{metadata.error?<p className="journal-help">Names could not load. Saved selections remain retained. <button onClick={metadata.retry}>Retry names</button></p>:null}<details className="draft-comparison-details"><summary>Retained field details</summary><dl>{draftFields(payload).map(field=><div key={field.label}><dt>{field.label}</dt><dd>{field.text||"Not entered"}</dd></div>)}</dl></details></>;
}
function ComparisonFields({ payload }: { payload: DraftPayload }) {
  if(payload.kind==="prayer-settings")return <SettingsFields payload={payload}/>;
  const [writing, ...details] = draftFields(payload);
  return <>{writing ? writing.text ? <label>{writing.label}<textarea readOnly value={writing.text} /></label> : <p className="journal-help">No writing entered.</p> : null}{details.length ? <details className="draft-comparison-details"><summary><span aria-hidden="true">▾ </span>Source and details</summary><dl>{details.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.text || "Not entered"}</dd></div>)}</dl></details> : null}</>;
}
export function DraftProtection({ controller }: { controller: DurableDraftController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  return <><p className="draft-status journal-help" role="status">{state.status === "keeping" ? "Keeping draft…" : state.status === "kept" ? "Draft kept on this device" : state.status === "copy-only" ? "Action already recorded. Remaining writing is kept for copying." : ""}</p>{state.status === "failed" ? <section className="journal-notice" role="alert"><p>Draft could not be kept — keep this page open. {state.error}</p><p>Copy your writing before leaving. A successful explicit save is separate from draft protection.</p><button onClick={() => void controller.flush().catch(() => undefined)}>Retry draft protection</button></section> : null}</>;
}

export function DraftRecovery({ controller, kind, targetKey, current, returnTo, canRecover, ready = true, adopt, validateRecovery }: {
  controller: DurableDraftController; kind: DraftPayload["kind"]; targetKey?: string; current: DraftPayload; returnTo: string;
  canRecover: boolean; ready?: boolean; adopt: (payload: DraftPayload, source: DraftSnapshot) => void;
  validateRecovery?: (source: DraftSnapshot) => Promise<void>;
}) {
  const [params] = useSearchParams(), requested = params.get("draft");
  const [review, setReview] = useState<{ snapshot: DraftSnapshot; previousJournal: boolean } | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [openAttempt, setOpenAttempt] = useState(0);
  const requestGeneration = useRef(0), alive = useRef(true), consumed = useRef("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestGeneration.current++; }; }, []);
  const page = usePrayerRead(`kept:${kind}:${targetKey ?? "new"}`, () => repository.list({ kind, ...(targetKey ? { targetKey } : {}), limit: 100 }));
  async function open(id: string) {
    const generation = ++requestGeneration.current;
    setError("");
    try {
      const result = await repository.read(id);
      if (!alive.current || generation !== requestGeneration.current) return;
      if (result.kind !== "active" || result.snapshot.contents.payload.kind !== kind || (targetKey && result.snapshot.metadata.targetKey !== targetKey)) throw new Error("This kept writing is no longer available in this editor.");
      setReview({ snapshot: result.snapshot, previousJournal: result.previousJournal });
    } catch (reason) { if (alive.current && generation === requestGeneration.current) setError(reason instanceof Error ? reason.message : "Could not open kept writing."); }
  }
  useEffect(() => {
    if (!requested || !ready) return;
    const token = `${requested}:${openAttempt}`;
    if (consumed.current === token) return;
    consumed.current = token;
    const generation = ++requestGeneration.current;
    let cancelled = false;
    let settled = false;
    void repository.read(requested).then(result => {
      settled = true;
      if (cancelled || generation !== requestGeneration.current) return;
      if (result.kind !== "active" || result.snapshot.contents.payload.kind !== kind || (targetKey && result.snapshot.metadata.targetKey !== targetKey)) { setError("This kept writing is no longer available in this editor."); return; }
      setReview({ snapshot: result.snapshot, previousJournal: result.previousJournal });
    }).catch(() => { settled = true; if (!cancelled && generation === requestGeneration.current) setError("Could not open kept writing. Your editor remains available."); });
    return () => { cancelled = true; if (!settled && requestGeneration.current === generation) consumed.current = ""; };
  }, [requested, ready, kind, targetKey, openAttempt]);
  const offers = page.data?.rows.filter(row => row.metadata?.state === "active" && row.id !== controller.getId()) ?? [];
  const close = () => { requestGeneration.current++; setReview(null); setError(""); };
  return <>
    {offers.length ? <details className="journal-context"><summary>Kept drafts for this editor</summary><p>Review a draft before choosing to recover it. Your current writing stays here.</p><div className="journal-actions journal-dialog-actions">{offers.map(row => <button key={row.id} disabled={busy} onClick={() => void open(row.id)}>Review kept draft · {new Date(row.metadata!.updatedAt).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}<Link to={recoveryUrl(null, returnTo)}>All recovery entries →</Link></div></details> : null}
    {page.error ? <p role="status">Could not check for kept drafts. <button onClick={page.retry}>Retry draft check</button></p> : null}
    {error && !review ? <p role="alert">{error}{requested ? <button onClick={() => setOpenAttempt(value => value + 1)}>Retry kept writing</button> : null}</p> : null}
    {review ? <JournalDialog title="Review kept writing" close={close} busy={busy}>
      <p data-initial-focus tabIndex={-1}>Compare this writing before recovering it. Your current editor stays unchanged until you choose.</p>
      <div className="journal-comparison"><div><h3>Your kept draft</h3><ComparisonFields payload={review.snapshot.contents.payload} /></div><div><h3>Current editor</h3><ComparisonFields payload={current} /></div></div>
      <p>Recovery keeps the original details, Scripture ranges, date and return context. No journal entry is saved by recovering.</p>
      {review.previousJournal ? <p>This writing belongs to a previous local journal. Keep it for copying; it cannot be attached automatically.</p> : !canRecover ? <p>Save or discard your current changes before recovering another draft.</p> : null}
      {review.snapshot.metadata.commitment?.disposition === "copy-only" ? <p>This action was already recorded. Copy remaining writing without repeating the action.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="journal-dialog-actions"><button className="grace-primary" disabled={busy || !canRecover || review.previousJournal || review.snapshot.metadata.commitment?.disposition === "copy-only"} onClick={async () => {
        if (busy) return; setBusy(true); setError("");
        try { await validateRecovery?.(review.snapshot); const payload = await controller.recover(review.snapshot.metadata.id, review.snapshot.metadata.generation); if (alive.current) { adopt(payload, review.snapshot); setReview(null); } }
        catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "Could not recover this writing."); }
        finally { if (alive.current) setBusy(false); }
      }}>Recover for review</button><button disabled={busy} onClick={close}>Keep current editor</button></div>
    </JournalDialog> : null}
  </>;
}
