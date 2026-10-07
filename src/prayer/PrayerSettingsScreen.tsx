import {useEffect,useRef,useState} from "react";
import {Link,useLocation,useNavigate,useParams} from "react-router-dom";
import {db} from "../data/database";
import {PrayerRepository} from "../data/repositories/prayers";
import {isEditConflict} from "../data/conflicts";
import {JournalHeading} from "../writing/JournalPrimitives";
import {PrayerAdministrationFields,administrationValueFrom,type PrayerAdministrationValue} from "./PrayerAdministrationFields";
import {readPrayerSettings,readPrayerMetadata,safePrayerReturn,type PrayerMetadata} from "./detail-model";
import {usePrayerRead} from "./detail-hooks";
import {usePrayerDraftGuard} from "./usePrayerDraftGuard";
import {useDurableDraft} from "../recovery/useDurableDraft";
import {DraftProtection,DraftRecovery} from "../recovery/DraftRecovery";
import {saveJournalDraft} from "../recovery/editor-adapters";
import {draftTargetKey} from "../recovery/validation";
import {DraftError,type DraftPayload} from "../recovery/types";
type SettingsPayload=Extract<DraftPayload,{kind:"prayer-settings"}>;
const repository=new PrayerRepository(db);
const scheduleNames={ROTATION:"Normal rotation",DAILY:"Daily",WEEKDAYS:"Selected weekdays",INTERVAL_DAYS:"Every few days",MONTHLY:"Monthly",ON_DATE:"One specific date",MANUAL_ONLY:"Manual only"};
function comparison(value:PrayerAdministrationValue,metadata:PrayerMetadata|undefined):[string,string][]{
 const items:[string,string][]=[
 ["Person",metadata?.people.find(person=>person.id===value.personId)?.name??(value.personId?"Unavailable person":"No person")],
 ["Category",metadata?.categories.find(category=>category.id===value.categoryId)?.name??(value.categoryId?"Unavailable category":"No category")],
 ["Schedule",scheduleNames[value.scheduleMode]]
 ];
 if(value.scheduleMode==="WEEKDAYS")items.push(["Weekdays",value.weekdays.map(day=>["","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][day]).join(", ")||"None selected"]);
 if(value.scheduleMode==="INTERVAL_DAYS")items.push(["Every",value.intervalDays+" days"],["Starting",value.anchorDate]);
 if(value.scheduleMode==="MONTHLY")items.push(["Day of month",value.monthlyDay]);
 if(value.scheduleMode==="ON_DATE")items.push(["Date",value.onDate]);
 items.push(["Event date",value.eventDate||"Not set"],["Focus until",value.focusUntil||"Not set"]);return items;
}
export function PrayerSettingsScreen(){const {prayerId=""}=useParams();return <PrayerSettings key={prayerId} prayerId={prayerId}/>;}
function PrayerSettings({prayerId}:{prayerId:string}){
 const location=useLocation(),navigate=useNavigate();const url=location.pathname+location.search,detailTarget=location.pathname.replace(/\/settings$/,"")+location.search;
 const load=usePrayerRead("settings:"+prayerId,()=>readPrayerSettings(db,prayerId));
 const metadata=usePrayerRead("settings-metadata",()=>readPrayerMetadata(db));
 const [value,setValue]=useState<PrayerAdministrationValue|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[conflict,setConflict]=useState(false);
 const [review,setReview]=useState<Awaited<ReturnType<typeof readPrayerSettings>>>(null),[reviewError,setReviewError]=useState("");
 const baseline=useRef<{value:PrayerAdministrationValue;prayer:SettingsPayload["baseline"];schedule:SettingsPayload["schedule"]}|null>(null),valueRef=useRef(value),saving=useRef(false);valueRef.current=value;
 const dirty=Boolean(value&&baseline.current&&JSON.stringify(value)!==JSON.stringify(baseline.current.value));
 const payload:SettingsPayload|null=value&&baseline.current?{kind:"prayer-settings",administration:value,baseline:baseline.current.prayer,schedule:baseline.current.schedule,baselineAdministration:baseline.current.value}:null;
 const recovery=useDurableDraft(db,{returnTo:url,reading:null},dirty?payload:null,dirty);
 const adoptBaseline=(model:NonNullable<typeof load.data>,raw=administrationValueFrom(model.prayer,model.schedule))=>{baseline.current={value:structuredClone(raw),prayer:{id:model.prayer.id,revision:model.prayer.revision,status:model.prayer.status,body:model.prayer.body},schedule:model.schedule?{id:model.schedule.id,revision:model.schedule.revision,administration:structuredClone(raw)}:null};};
 useEffect(()=>{if(load.data&&(!baseline.current||!dirty)&&!saving.current){const next=administrationValueFrom(load.data.prayer,load.data.schedule);adoptBaseline(load.data,next);valueRef.current=next;setValue(next);}},[load.data,dirty]);
 useEffect(()=>{if(dirty&&load.data&&baseline.current&&!saving.current&&(load.data.prayer.revision!==baseline.current.prayer.revision||(load.data.schedule?.revision??null)!==(baseline.current.schedule?.revision??null))){setConflict(true);setReview(null);}},[load.data,dirty]);
 const discard=async()=>{await recovery.controller.discard();const original=baseline.current?.value??null;valueRef.current=original;setValue(original);setMessage("");setConflict(false);setReview(null);};
 const save=async()=>{
  if(saving.current)throw new Error("Please wait for the current save to finish.");
  const captured=valueRef.current;if(!captured||!baseline.current||!load.data||!payload||conflict)throw new Error("Review the saved prayer before saving. Your changes stay here.");
  if(JSON.stringify(captured)===JSON.stringify(baseline.current.value))return;
  saving.current=true;setBusy(true);setMessage("");
  try{
   recovery.controller.stage({...payload,administration:captured});
   const committed=await recovery.controller.commit(context=>saveJournalDraft(db,context),(latest,submitted,result)=>{
    if(latest.kind!=="prayer-settings"||submitted.kind!=="prayer-settings")return latest;
    return {...latest,baseline:{...latest.baseline,...result.marker.records[0]!},baselineAdministration:structuredClone(submitted.administration),schedule:result.marker.records[1]?{...result.marker.records[1],administration:structuredClone(submitted.administration)}:null};
   });
   if(!committed.prayer)throw new Error("Details were recorded. Retry the view without saving again.");
   const saved={prayer:committed.prayer,schedule:committed.schedule??null};
   adoptBaseline(saved,captured);
   // Keep the committed result even when the following optional refresh fails.
   load.accept(()=>saved);
   setConflict(false);setReview(null);
   if(JSON.stringify(valueRef.current)!==JSON.stringify(captured))throw new Error("Your earlier details were saved. Newer changes are still unsaved.");
   setMessage("Saved locally.");
  }catch(reason){if(isEditConflict(reason)||reason instanceof DraftError&&reason.code==="stale"){setConflict(true);setReview(null);}setMessage(reason instanceof Error?reason.message:"Could not save these details.");throw reason;}
  finally{saving.current=false;setBusy(false);}
 };
 const guard=usePrayerDraftGuard({dirty,save,discard,pending:busy,canSave:!conflict});
 const editable=load.data?.prayer.status==="ACTIVE"||load.data?.prayer.status==="WAITING";
 const change=(next:PrayerAdministrationValue)=>{valueRef.current=next;setValue(next);};
 const header=<JournalHeading title="Prayer settings" subtitle="People, rhythm & focus" back={load.data===null?safePrayerReturn(new URLSearchParams(location.search).get("return")):detailTarget}/>;
 if(load.data===undefined)return <main className="journal-workspace prayer-settings-journal">{header}{load.error?<div role="alert" className="journal-notice"><p>Could not open these settings. Your saved records are unchanged.</p><button onClick={load.retry}>Retry</button></div>:<p role="status">Opening prayer details…</p>}</main>;
 if(load.data===null)return <main className="journal-workspace prayer-settings-journal">{header}<p>This prayer is no longer available. It will not be recreated.</p>{dirty&&value?<SettingsComparison title="Your unsaved changes" value={value} metadata={metadata.data}/>:null}{guard.dialog}</main>;
 return <main className="journal-workspace prayer-settings-journal">{header}
  {!editable?<p className="journal-notice">This prayer is {load.data.prayer.status.toLowerCase()}. Its details are read-only.</p>:null}
  {value?<>{payload?<DraftRecovery controller={recovery.controller} kind="prayer-settings" targetKey={draftTargetKey(payload,"")} current={payload} returnTo={url} canRecover={!dirty&&!busy&&editable} validateRecovery={async source=>{const kept=source.contents.payload;if(kept.kind!=="prayer-settings")throw new Error("Wrong editor.");const current=await repository.get(kept.baseline.id);if(!current||current.status!=="ACTIVE"&&current.status!=="WAITING")throw new Error("This prayer is removed or read-only. Keep its details for copying.");}} adopt={kept=>{if(kept.kind!=="prayer-settings")return;baseline.current={value:kept.baselineAdministration??kept.schedule?.administration??administrationValueFrom(load.data!.prayer,load.data!.schedule),prayer:kept.baseline,schedule:kept.schedule};valueRef.current=kept.administration;setValue(kept.administration);setConflict(kept.baseline.revision!==load.data!.prayer.revision||(kept.schedule?.revision??null)!==(load.data!.schedule?.revision??null));setReview(null);setMessage("Draft recovered on this device. Details are not yet saved.");}}/>:null}<div className="journal-paper prayer-settings-paper">
   <fieldset disabled={!editable||busy} className="prayer-settings-section"><legend>People &amp; category</legend>
    <fieldset disabled={metadata.data===undefined||Boolean(metadata.error)} className="prayer-metadata-fields"><PrayerAdministrationFields section="people" value={value} people={metadata.data?.people??[]} categories={metadata.data?.categories??[]} onChange={change}/></fieldset>
    {metadata.error?<div role="alert"><p>People and categories could not load. Your existing selections are retained.</p><button onClick={metadata.retry}>Retry people and categories</button></div>:null}
    <div className="prayer-management-links"><Link to={"/prayer/people?"+new URLSearchParams({return:url})}>Manage people</Link><Link to={"/prayer/categories?"+new URLSearchParams({return:url})}>Manage categories</Link></div>
   </fieldset>
   <fieldset disabled={!editable||busy} className="prayer-settings-section"><legend>When to pray</legend><PrayerAdministrationFields section="schedule" value={value} people={[]} categories={[]} onChange={change}/></fieldset>
   <fieldset disabled={!editable||busy} className="prayer-settings-section"><legend>Dates &amp; focus</legend><PrayerAdministrationFields section="dates" value={value} people={[]} categories={[]} onChange={change}/></fieldset>
  </div>
  <DraftProtection controller={recovery.controller}/>
  <div className="journal-actions prayer-settings-actions">{editable?<button className="grace-primary" disabled={busy||!dirty||conflict} onClick={()=>{void save().then(()=>{guard.allowNavigation();navigate(detailTarget,{replace:true});}).catch(()=>{});}}>{busy?"Saving…":"Save details"}</button>:null}<Link to={detailTarget}>Cancel</Link></div>
  <p className="journal-status" role="status">{message||(dirty?"Unsaved changes":"Saved locally")}</p>
  <p className="journal-help">Kept drafts remain unfinished details on this device. Save explicitly to change this prayer's settings.</p></>:null}
  {load.error?<div className="journal-notice" role="alert"><p>{load.error}</p><button onClick={load.retry}>Retry details</button></div>:null}
  {conflict&&value?<section className="journal-conflict"><h2>Review changed details</h2><p>Your changes are still here. Compare the saved version before choosing what to keep.</p>{reviewError?<p role="alert">{reviewError}</p>:null}
   {!review?<button onClick={()=>{void readPrayerSettings(db,prayerId).then(next=>{if(!next)throw new Error("This prayer is no longer available.");setReview(next);}).catch(reason=>setReviewError(reason.message));}}>Compare versions</button>:<>
    <div className="prayer-settings-comparison"><SettingsComparison title="Your changes" value={value} metadata={metadata.data}/><SettingsComparison title="Saved version" value={administrationValueFrom(review.prayer,review.schedule)} metadata={metadata.data}/></div>
    <button disabled={busy} onClick={()=>{void recovery.controller.discard().then(()=>{const next=administrationValueFrom(review.prayer,review.schedule);adoptBaseline(review,next);change(next);load.accept(()=>review);setConflict(false);setReview(null);setMessage("Saved details loaded.");}).catch(reason=>setMessage(reason instanceof Error?reason.message:"Keep your details open and retry."));}}>Use saved details</button>
    {(review.prayer.status==="ACTIVE"||review.prayer.status==="WAITING")?<button disabled={busy} onClick={()=>{adoptBaseline(review);load.accept(()=>review);setConflict(false);setReview(null);setMessage("Your changes are ready for an explicit save.");}}>Keep my changes for review</button>:null}
   </>}
  </section>:null}
  {guard.dialog}
 </main>;
}
function SettingsComparison({title,value,metadata}:{title:string;value:PrayerAdministrationValue;metadata:PrayerMetadata|undefined}){
 return <section className="prayer-settings-version"><h3>{title}</h3><dl>{comparison(value,metadata).map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl></section>;
}
