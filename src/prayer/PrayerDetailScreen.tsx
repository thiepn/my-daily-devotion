import {useEffect,useRef,useState} from "react";
import {Link,useLocation,useNavigate,useParams} from "react-router-dom";
import {db} from "../data/database";
import {PrayerRepository} from "../data/repositories/prayers";
import {isEditConflict} from "../data/conflicts";
import type {Prayer,PrayerStatus} from "../domain/types";
import {JournalDialog,JournalHeading,WritingPreview} from "../writing/JournalPrimitives";
import {ScriptureContext} from "../writing/ScriptureContext";
import {buildReflectionUrl} from "../reflection/context";
import {parsePrayerDetailQuery,prayerTimeline,readPrayerDetail,readPrayerMetadata,readPrayerSettings,type PrayerDetailModel} from "./detail-model";
import {usePrayerPosition,usePrayerRead} from "./detail-hooks";
import {usePrayerDraftGuard} from "./usePrayerDraftGuard";
import {scheduleLabel} from "./scheduling";
import {personInitials} from "./journal";
const repository=new PrayerRepository(db);
type Editor="wording"|"update"|"encouragement"|"answer"|null;
const date=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(new Date(value));
export function PrayerDetailScreen(){const {prayerId=""}=useParams();return <PrayerRecord key={prayerId} prayerId={prayerId}/>;}
function PrayerRecord({prayerId}:{prayerId:string}) {
 const location=useLocation(),navigate=useNavigate(),query=parsePrayerDetailQuery(location.search);
 const url=location.pathname+query.search;
 const load=usePrayerRead(prayerId,()=>readPrayerDetail(db,prayerId));
 const metadata=usePrayerRead("detail-metadata",()=>readPrayerMetadata(db));
 const administration=usePrayerRead("detail-administration:"+prayerId,()=>readPrayerSettings(db,prayerId));
 const model=load.data,prayer=model?.prayer;
 const [editor,setEditor]=useState<Editor>(null),[draft,setDraft]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const [conflict,setConflict]=useState(false),[review,setReview]=useState<Prayer|null>(null),[reviewError,setReviewError]=useState("");
 const [removeOpen,setRemoveOpen]=useState(false),[expanded,setExpanded]=useState<Set<string>>(new Set());
 const draftRef=useRef(draft);draftRef.current=draft;
 const baseline=useRef<{body:string;revision:number}|null>(null),acting=useRef(false),editorRef=useRef<HTMLTextAreaElement>(null);
 const committed=useRef<{serial:number;prayer:Prayer|null}>({serial:0,prayer:null});
 const noteCommit=(saved:Prayer)=>{committed.current={serial:committed.current.serial+1,prayer:saved};if(baseline.current?.body===saved.body)baseline.current={body:saved.body,revision:saved.revision};};
 const dirty=editor==="wording"?draft!==baseline.current?.body:editor==="answer"||Boolean(editor&&draft.trim());
 const rows=model?prayerTimeline(model):[];
 const selectedIndex=rows.findIndex(row=>row.id===query.entry),shown=Math.max(query.shown,selectedIndex>=0?Math.ceil((selectedIndex+1)/20)*20:20);
 const selected=selectedIndex>=0?query.entry:null;
 usePrayerPosition(url,Boolean(model),selected);
 useEffect(()=>{if(location.search!==query.search)navigate(location.pathname+query.search,{replace:true});},[location.pathname,location.search,query.search,navigate]);
 useEffect(()=>{if(selected)setExpanded(old=>new Set(old).add(selected));},[selected]);
 useEffect(()=>{if(editor)editorRef.current?.focus();},[editor]);
 useEffect(()=>{if(editor==="wording"&&prayer&&!dirty&&!acting.current){baseline.current={body:prayer.body,revision:prayer.revision};draftRef.current=prayer.body;setDraft(prayer.body);}},[prayer,editor,dirty]);
 const discard=()=>{draftRef.current="";setDraft("");setEditor(null);setConflict(false);setReview(null);setMessage("");};
 const accept=(change:(current:PrayerDetailModel)=>PrayerDetailModel)=>load.accept(current=>current?change(current):current??null);
 const perform=async(action:()=>Promise<void>)=>{
  if(acting.current)throw new Error("Please wait for the current action to finish.");
  acting.current=true;setBusy(true);setMessage("");
  try{await action();}catch(reason){if(isEditConflict(reason)){setConflict(true);setReview(null);}setMessage(reason instanceof Error?reason.message:"Could not save. Please try again.");throw reason;}finally{acting.current=false;setBusy(false);}
 };
 const saveEditor=async()=>perform(async()=>{
  if(!prayer||!editor)throw new Error("This prayer is no longer available.");
  const captured=draftRef.current,revision=baseline.current?.revision??prayer.revision;
  if(editor==="wording"){
   const saved=await repository.updateBody(prayerId,captured,revision);baseline.current={body:saved.body,revision:saved.revision};noteCommit(saved);accept(current=>({...current,prayer:saved}));
   if(draftRef.current!==captured)throw new Error("Your earlier wording was saved. Newer changes are still unsaved.");
  }else if(editor==="answer"){
   const saved=await repository.answer(prayerId,captured,undefined,revision);accept(current=>({...current,prayer:saved.prayer,resolution:saved.resolution}));
  }else{
   const saved=await db.transaction("rw",db.prayers,db.prayerUpdates,db.activityEvents,async()=>{const update=await repository.addUpdate(prayerId,captured,editor);const item=await repository.get(prayerId);if(!item)throw new Error("Prayer unavailable.");return {update,prayer:item};});noteCommit(saved.prayer);accept(current=>({...current,prayer:saved.prayer,updates:[...current.updates.filter(item=>item.id!==saved.update.id),saved.update]}));
   if(draftRef.current!==captured)throw new Error("Your update was recorded. Newer writing is still unsaved.");
  }
  setConflict(false);setReview(null);draftRef.current="";setDraft("");setEditor(null);setMessage("Saved locally.");load.retry();
 });
 const guard=usePrayerDraftGuard({dirty,save:saveEditor,discard,answer:editor==="answer",canSave:Boolean(draft.trim())});
 const startEditor=(next:Editor)=>{
  const serial=committed.current.serial;
  guard.request(()=>{
   // A guarded switch may have just saved the previous editor. Use that result,
   // rather than the prayer captured before the confirmation dialog opened.
   const current=committed.current.serial!==serial?committed.current.prayer:prayer;
   if(!current)return;
   baseline.current={body:current.body,revision:current.revision};
   const text=next==="wording"?current.body:"";
   draftRef.current=text;setDraft(text);setEditor(next);setConflict(false);setReview(null);setMessage("");
  });
 };
 const run=(action:()=>Promise<void>)=>void perform(action).catch(()=>{});
 const transition=(status:PrayerStatus)=>{const serial=committed.current.serial;guard.request(()=>run(async()=>{if(!prayer)return;const revision=committed.current.serial!==serial?committed.current.prayer!.revision:prayer.revision;const saved=await repository.transition(prayerId,status,revision);accept(current=>({...current,prayer:saved}));discard();setMessage(status==="ARCHIVED"?"Prayer archived.":"Prayer status updated.");load.retry();}));};
 const editorTitle=editor==="wording"?"Edit wording":editor==="answer"?"Record an answer":editor==="encouragement"?"Add encouragement":"Add update";
 const saveLabel=editor==="wording"?"Save wording":editor==="answer"?"Mark answered":editor==="encouragement"?"Add encouragement":"Add update";
 if(model===undefined)return <main className="journal-workspace prayer-record"><JournalHeading title="Prayer" subtitle="Your prayer journal" back={query.returnTo}/>{load.error?<div role="alert" className="journal-notice"><p>Could not open this prayer. Your saved records are unchanged.</p><button onClick={load.retry}>Retry</button></div>:<p role="status">Opening prayer…</p>}</main>;
 if(model===null)return <main className="journal-workspace prayer-record"><JournalHeading title="Prayer unavailable" subtitle="Your prayer journal" back={query.returnTo}/><p>This prayer has been removed or is no longer available.</p>{dirty?<div className="journal-notice"><h2>Your unsaved writing</h2><p>It has not been saved. You can copy it before leaving.</p><textarea aria-label="Unsaved prayer writing" value={draft} readOnly/></div>:null}{guard.dialog}</main>;
 const editable=prayer!.status==="ACTIVE"||prayer!.status==="WAITING";
 const person=metadata.data?.people.find(item=>item.id===prayer!.personId),category=metadata.data?.categories.find(item=>item.id===prayer!.categoryId);
 const settingsUrl=location.pathname+"/settings"+query.search;
 return <main className="journal-workspace prayer-record">
  <JournalHeading title="Prayer" subtitle={prayer!.status.toLowerCase()} back={query.returnTo}/>
  <section className="journal-paper prayer-request" aria-label="Prayer request">
   {person?<div className="prayer-record-person"><span className="prayer-record-initials" aria-hidden="true">{personInitials(person.name)}</span><div><strong>{person.name}</strong>{person.relationship?<small>{person.relationship}</small>:null}</div></div>:null}
   <p className="prayer-request-text">{prayer!.body}</p>
   {editable?<button id="edit-prayer-wording" disabled={busy} onClick={()=>startEditor("wording")}>Edit wording</button>:null}
   <dl className="prayer-record-dates"><div><dt>Created</dt><dd>{date(prayer!.createdAt)}</dd></div><div><dt>Last prayed</dt><dd>{prayer!.lastPrayedAt?date(prayer!.lastPrayedAt):"Not recorded yet"}</dd></div></dl>
  </section>
  <div className="prayer-record-actions">
   {prayer!.status==="ACTIVE"?<button className="grace-primary" disabled={busy} onClick={()=>run(async()=>{const saved=await repository.markPrayed(prayerId);noteCommit(saved);accept(current=>({...current,prayer:saved}));setMessage("Prayed now recorded.");load.retry();})}>Prayed now</button>:null}
   {editable?<><button id="open-prayer-update" disabled={busy} onClick={()=>startEditor("update")}>Add update</button><button disabled={busy} onClick={()=>startEditor("answer")}>Mark answered</button></>:null}
   {prayer!.status==="WAITING"?<button disabled={busy} onClick={()=>transition("ACTIVE")}>Return to active</button>:null}
   {prayer!.status==="ARCHIVED"?<button className="grace-primary" disabled={busy} onClick={()=>run(async()=>{const saved=await repository.restoreArchived(prayerId,prayer!.revision);accept(current=>({...current,prayer:saved}));setMessage("Prayer restored.");load.retry();})}>Restore to {model.resolution?"answered":"active"}</button>:null}
  </div>
  {editor?<section className="journal-paper prayer-record-editor" aria-label={editorTitle}>
   <div className="prayer-editor-heading"><h2>{editorTitle}</h2><span className="save-state" role="status">{busy?"Saving…":dirty?"Unsaved changes":editor==="wording"?"Saved locally":"Not saved yet"}</span></div>
   {(editor==="update"||editor==="encouragement")?<div className="journal-tabs"><button disabled={busy} aria-pressed={editor==="update"} onClick={()=>setEditor("update")}>Update</button><button disabled={busy} aria-pressed={editor==="encouragement"} onClick={()=>setEditor("encouragement")}>Encouragement</button></div>:null}
   {!editable?<p className="journal-notice">This prayer is now read-only. Your unsaved writing is still here to copy or discard.</p>:null}
   <label htmlFor="prayer-record-writing">{editor==="answer"?"What happened? (optional)":editor==="wording"?"Request":"Prayer update"}</label>
   <textarea ref={editorRef} id="prayer-record-writing" className="journal-textarea" disabled={busy&&editor==="answer"} value={draft} onChange={event=>{draftRef.current=event.target.value;setDraft(event.target.value);}}/>
   <div className="journal-actions"><button className="grace-primary" disabled={!editable||busy||(editor!=="answer"&&!draft.trim())||(editor==="wording"&&!dirty)} onClick={()=>void saveEditor().catch(()=>{})}>{saveLabel}</button><button disabled={busy} onClick={()=>guard.request(discard)}>Cancel editing</button></div>
   <p className="journal-help">Save to keep your writing on this device. Unsaved changes are lost when the app closes.</p>
  </section>:null}
  {message?<p className="journal-status" role="status">{message}</p>:null}
  {conflict?<section className="journal-conflict"><h2>Review the saved prayer</h2><p>Your writing is still here. Review changes from another tab before continuing.</p>{reviewError?<p role="alert">{reviewError}</p>:null}
   {!review?<button onClick={()=>{void repository.get(prayerId).then(latest=>{if(!latest)throw new Error("This prayer is no longer available.");setReview(latest);}).catch(reason=>setReviewError(reason.message));}}>Compare versions</button>:<>
    {editor?<><label>Your changes<textarea aria-label="Your changes" readOnly value={draft}/></label><label>Saved version<textarea aria-label="Saved version" readOnly value={review.body}/></label><p>Status: {review.status.toLowerCase()}</p></>:<p className="prayer-request-text">{review.body}</p>}
    {editor==="wording"&&(review.status==="ACTIVE"||review.status==="WAITING")?<><button onClick={()=>{baseline.current={body:review.body,revision:review.revision};draftRef.current=review.body;setDraft(review.body);accept(current=>({...current,prayer:review}));setConflict(false);setReview(null);requestAnimationFrame(()=>editorRef.current?.focus());}}>Use saved wording</button><button onClick={()=>{baseline.current={body:review.body,revision:review.revision};accept(current=>({...current,prayer:review}));setConflict(false);setReview(null);setMessage("Your wording is ready for an explicit save.");requestAnimationFrame(()=>editorRef.current?.focus());}}>Keep my wording for review</button></>:<button onClick={()=>{accept(current=>({...current,prayer:review}));if(editor)baseline.current={body:review.body,revision:review.revision};setConflict(false);setReview(null);load.retry();}}>I have reviewed the saved prayer</button>}
   </>}
  </section>:null}
  {load.error?<div className="journal-notice" role="alert"><p>{load.error} Completed actions stay saved; Retry only reloads this view.</p><button onClick={load.retry}>Retry details</button></div>:null}
  {metadata.error?<div className="journal-notice"><p>People and categories could not load. Your request is still available.</p><button onClick={metadata.retry}>Retry people and categories</button></div>:null}
  {model.links.length?<details className="journal-context"><summary>Linked Scripture<span>{model.links.length} {model.links.length===1?"passage":"passages"}</span></summary>{model.links.map(link=><ScriptureContext key={link.id} reference={link} returnTo={url}/>)}</details>:null}
  {prayer!.sourceReflectionId?<details className="journal-context"><summary>From your reflection<span>{prayer!.sourceDevotionDate??"Original reflection"}</span></summary>{model.source?<><WritingPreview text={model.source.bodyMd}/><Link id="prayer-source-reflection" className="prayer-context-link" to={buildReflectionUrl(model.source.localDate,null,url)}>Open reflection</Link></>:<p className="journal-help">The original reflection is no longer available.</p>}</details>:null}
  <section className="prayer-story" aria-labelledby="prayer-story-heading"><div className="prayer-story-heading"><h2 id="prayer-story-heading">Updates &amp; encouragement</h2><span>Newest first</span></div>
   {query.entry&&!selected?<p className="journal-help">That entry is no longer available. The remaining story is shown below.</p>:null}
   {rows.length?<>{rows.slice(0,shown).map(row=><article id={"prayer-entry-"+row.id} key={row.id} tabIndex={-1} className={"prayer-story-entry is-"+row.kind}>
    <div className="prayer-story-meta"><span>{row.kind==="answer"?"Answered":row.kind==="encouragement"?"Encouragement":"Update"}</span><time dateTime={row.at}>{date(row.at)}</time></div>
    <p>{row.body?row.body.length>320&&!expanded.has(row.id)?row.body.slice(0,320).trimEnd()+"…":row.body:"No answer note was added."}</p>
    {row.body.length>320?<button aria-expanded={expanded.has(row.id)} onClick={()=>setExpanded(old=>{const next=new Set(old);if(next.has(row.id))next.delete(row.id);else next.add(row.id);return next;})}>{expanded.has(row.id)?"Show less":"Read more"}</button>:null}
   </article>)}<div className="prayer-story-pagination"><p>{Math.min(shown,rows.length)} of {rows.length} entries</p>{shown<rows.length?<button onClick={()=>{const params=new URLSearchParams(query.search);params.set("shown",String(shown+20));navigate(location.pathname+"?"+params.toString(),{preventScrollReset:true});}}>Show more</button>:null}</div></>:<p className="prayer-story-empty">Updates, encouragement, and a recorded answer will appear here as this prayer's story develops.</p>}
  </section>
  <section className="prayer-record-settings" aria-label="Prayer settings"><div className="prayer-story-heading"><h2>Prayer details</h2>{editable?<Link id="prayer-settings-link" to={settingsUrl}>Edit details</Link>:null}</div>
   <dl><div><dt>Person</dt><dd>{person?.name??(prayer!.personId?"Unavailable":"No person")}</dd></div><div><dt>Category</dt><dd>{category?.name??(prayer!.categoryId?"Unavailable":"No category")}</dd></div><div><dt>Schedule</dt><dd>{administration.error?"Unavailable":administration.data===undefined?"Loading…":scheduleLabel(administration.data?.schedule??null)}</dd></div>{prayer!.eventDate?<div><dt>Event date</dt><dd>{prayer!.eventDate}</dd></div>:null}{prayer!.focusUntil?<div><dt>Focus until</dt><dd>{prayer!.focusUntil}</dd></div>:null}</dl>
   {administration.error?<button onClick={administration.retry}>Retry schedule</button>:null}
  </section>
  <details className="prayer-more-actions"><summary>More actions</summary>{prayer!.status==="ACTIVE"?<button disabled={busy} onClick={()=>transition("WAITING")}>Move to waiting</button>:null}{prayer!.status!=="ARCHIVED"?<button disabled={busy} onClick={()=>transition("ARCHIVED")}>Archive prayer</button>:null}<button className="prayer-remove" disabled={busy} onClick={()=>guard.request(()=>setRemoveOpen(true))}>Remove prayer</button></details>
  {guard.dialog}
  {removeOpen?<JournalDialog title="Remove this prayer?" busy={busy} close={()=>setRemoveOpen(false)}><p>The request, its updates, and answer will be removed from current views. Existing backups are unaffected.</p><div className="journal-dialog-actions"><button className="prayer-remove" disabled={busy} onClick={()=>run(async()=>{await repository.removePrayer(prayerId,prayer!.revision);guard.allowNavigation();navigate(query.returnTo,{replace:true});})}>Remove prayer</button><button disabled={busy} data-initial-focus onClick={()=>setRemoveOpen(false)}>Keep prayer</button></div>{message?<p role="alert">{message}</p>:null}</JournalDialog>:null}
 </main>;
}
