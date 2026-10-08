import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../data/database";
import { JournalDialog, JournalHeading } from "../writing/JournalPrimitives";
import { usePrayerPosition, usePrayerRead } from "../prayer/detail-hooks";
import { usePrayerDraftGuard } from "../prayer/usePrayerDraftGuard";
import { RecoveryNavigation } from "./SavedVersionsLink";
import { parseRecoveryContext } from "./presentation";
import { listRemovals, removedFields, removedUrl, removalState } from "./removal-presentation";
import { readRemoval, REMOVAL_LABELS, restoreRemoval, type RestoreRemovalResult } from "./removals";

type Available = Extract<Awaited<ReturnType<typeof readRemoval>>, {kind:"available"}>;
const time = (value:string) => new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
export function RemovedScreen() {
  const location = useLocation();
  return <RemovedView key={location.pathname + location.search} />;
}
function RemovedView() {
  const {groupId} = useParams(), location = useLocation(), navigate = useNavigate();
  const context = parseRecoveryContext(location.search), url = location.pathname + location.search;
  const directory = removedUrl(null,context.returnTo,context.shown);
  const listing = usePrayerRead(`removed-list:${context.shown}`,async()=>groupId?null:listRemovals(db,context.shown));
  const selected = usePrayerRead(`removed:${groupId??"none"}`,async()=>groupId?readRemoval(db,groupId):null);
  const current = selected.data?.kind === "available" ? selected.data : null;
  const [now,setNow] = useState(Date.now), [confirmation,setConfirmation] = useState<Available|null>(null);
  const [busy,setBusy] = useState(false), [result,setResult] = useState<RestoreRemovalResult|null>(null);
  const lock = useRef(false);
  const guard = usePrayerDraftGuard({dirty:false,pending:busy,save:async()=>undefined,discard:()=>undefined});
  usePrayerPosition(url,Boolean(groupId?selected.data:listing.data),null,".recovery-journal","removed-entry-");
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30_000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    if(params.has("shown")&&params.get("shown")!==String(context.shown)||params.has("return")&&params.get("return")!==context.returnTo)
      navigate(removedUrl(groupId??null,context.returnTo,context.shown),{replace:true});
  },[location.search,context.shown,context.returnTo,groupId,navigate]);
  async function restore() {
    if(lock.current||!confirmation)return;
    lock.current=true;setBusy(true);
    try {const committed=await restoreRemoval(db,confirmation.metadata.id,confirmation.fingerprint);setResult(committed);setConfirmation(null);selected.retry();}
    finally {lock.current=false;setBusy(false);}
  }
  const committed=result?.kind==="committed"||result?.kind==="unchanged";
  const reason=current?removalState(current.metadata,current.previousJournal,now):"";
  const error=groupId?selected.error:listing.error;
  return <main className="journal-workspace recovery-journal removed-journal">
    <JournalHeading title={groupId?"Removed writing":"Recently removed"} subtitle="Room to change your mind" back={groupId?directory:context.returnTo} />
    {!groupId?<RecoveryNavigation returnTo={context.returnTo} removed />:null}
    <p className="journal-help">Removed entries can be restored for thirty days, while their original records remain unchanged. Restoration preserves their dates and identity; it does not record new devotional activity. Existing backups are unaffected.</p>
    {error?<section className="journal-notice" role="alert"><p>{error}</p><button onClick={groupId?selected.retry:listing.retry}>Retry refresh</button></section>:null}
    {result?<section className="journal-notice" role="status"><p>{committed?result.kind==="unchanged"?"These records were already restored. Nothing was changed.":"The removed records were restored locally. Their original dates and recorded activity were preserved.":"reason" in result?result.reason:""}</p>{!committed?<button onClick={()=>{setResult(null);selected.retry();}}>Review recovery entry</button>:<Link to={context.returnTo}>Return to journal</Link>}</section>:null}
    {!groupId?listing.data?<>
      {listing.data.total?<ul className="recovery-directory">{listing.data.rows.map(row=><li key={row.id}><Link id={`removed-entry-${row.id}`} to={removedUrl(row.id,context.returnTo,context.shown)}><span><strong>{row.metadata?REMOVAL_LABELS[row.metadata.rootTable]:"Unavailable removal"}</strong>{row.metadata?<><small>Removed {time(row.metadata.removedAt)}</small><small>{row.metadata.state==="restored"?"Restored":now>=Date.parse(row.metadata.expiresAt)?"Copy available · recovery window ended":`Restore before ${time(row.metadata.expiresAt)}`}</small></>:<small>Review this entry</small>}</span><span aria-hidden="true">›</span></Link></li>)}</ul>:<section className="journal-paper recovery-empty"><h2>Nothing recently removed.</h2><p>Supported entries removed from this device will appear here. Your saved journal remains in its usual places.</p></section>}
      {listing.data.total?<div className="recovery-pagination"><p>{listing.data.rows.length} of {listing.data.total} removals</p>{listing.data.rows.length<listing.data.total?<Link className="quiet-button" id="removed-show-more" to={removedUrl(null,context.returnTo,context.shown+20)} replace>Show more</Link>:null}</div>:null}
    </>:!error?<p role="status">Opening recently removed…</p>:null:current?<>
      <p className="recovery-kept-time">{REMOVAL_LABELS[current.metadata.rootTable]} · Removed {time(current.metadata.removedAt)}<br />Original recovery window ends {time(current.metadata.expiresAt)}</p>
      {reason?<p className="journal-notice">{reason}</p>:null}
      <section className="journal-paper recovery-writing"><h2>Retained records</h2><p>{current.contents.records.length} {current.contents.records.length===1?"record":"records"} from this removal. Only children removed by that operation are included.</p>{current.contents.records.map((item,index)=><section className="removed-record" key={`${item.table}:${item.record.id}`}>{removedFields(item).map((field,fieldIndex)=><div className="version-field" key={field.label}><label htmlFor={`removed-${index}-${fieldIndex}`}>{field.label}</label>{["Devotional date","Status","Recorded","Answered","Prayer schedule"].includes(field.label)?<input id={`removed-${index}-${fieldIndex}`} readOnly value={field.text} />:<textarea id={`removed-${index}-${fieldIndex}`} readOnly value={field.text} />}<button className="quiet-button" onClick={()=>{const element=document.getElementById(`removed-${index}-${fieldIndex}`) as HTMLTextAreaElement|HTMLInputElement|null;element?.focus();element?.select();}}>Select {field.label.toLowerCase()} to copy</button></div>)}</section>)}</section>
      {!reason&&!committed?<button className="grace-primary" disabled={busy||Boolean(result)} onClick={event=>{event.currentTarget.focus();setConfirmation(current);}}>Restore removed records</button>:null}
    </>:selected.data?<section className="journal-paper recovery-empty"><h2>This removal is unavailable.</h2><p>Return to Recently removed to check other writing. No records have been changed.</p></section>:!error?<p role="status">Opening removed writing…</p>:null}
    {confirmation?<JournalDialog title="Restore removed records?" busy={busy} close={()=>setConfirmation(null)}><p>Restore the reviewed {REMOVAL_LABELS[confirmation.metadata.rootTable].toLowerCase()} and {confirmation.contents.records.length-1} related records removed by that operation. Changed records or unavailable relationships will prevent restoration. This does not add History activity.</p><div className="journal-dialog-actions"><button className="grace-primary" disabled={busy} onClick={()=>void restore()}>{busy?"Restoring…":"Restore records"}</button><button data-initial-focus disabled={busy} onClick={()=>setConfirmation(null)}>Keep removed</button></div></JournalDialog>:null}
    {guard.dialog}
  </main>;
}
