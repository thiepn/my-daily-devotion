import {useEffect,useRef,useState} from "react";
import {Link,useLocation,useNavigate,useParams} from "react-router-dom";
import {db} from "../data/database";
import {PrayerRepository} from "../data/repositories/prayers";
import {isEditConflict} from "../data/conflicts";
import {JournalHeading} from "../writing/JournalPrimitives";
import {PrayerAdministrationFields,administrationValueFrom,administrationInputFromValue,type PrayerAdministrationValue} from "./PrayerAdministrationFields";
import {readPrayerSettings,readPrayerMetadata,safePrayerReturn,type PrayerMetadata} from "./detail-model";
import {usePrayerRead} from "./detail-hooks";
import {usePrayerDraftGuard} from "./usePrayerDraftGuard";
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
 const baseline=useRef<{value:PrayerAdministrationValue;revision:number}|null>(null),valueRef=useRef(value),saving=useRef(false);valueRef.current=value;
 const dirty=Boolean(value&&baseline.current&&JSON.stringify(value)!==JSON.stringify(baseline.current.value));
 useEffect(()=>{if(load.data&&(!baseline.current||!dirty)&&!saving.current){const next=administrationValueFrom(load.data.prayer,load.data.schedule);baseline.current={value:next,revision:load.data.prayer.revision};valueRef.current=next;setValue(next);}},[load.data,dirty]);
 const discard=()=>{const original=baseline.current?.value??null;valueRef.current=original;setValue(original);setMessage("");setConflict(false);setReview(null);};
 const save=async()=>{
  if(saving.current)throw new Error("Please wait for the current save to finish.");
  const captured=valueRef.current;if(!captured||!baseline.current||!load.data)throw new Error("This prayer is no longer available.");
  if(JSON.stringify(captured)===JSON.stringify(baseline.current.value))return;
  saving.current=true;setBusy(true);setMessage("");
  try{
   const saved=await db.transaction("rw",db.prayers,db.prayerSchedules,db.people,db.categories,async()=>{
    const prayer=await repository.updateAdministration(prayerId,administrationInputFromValue(captured),baseline.current!.revision);
    const schedule=prayer.scheduleId?await db.prayerSchedules.get(prayer.scheduleId):null;
    return {prayer,schedule:schedule&&!schedule.deletedAt?schedule:null};
   });
   baseline.current={value:captured,revision:saved.prayer.revision};
   // Keep the committed result even when the following optional refresh fails.
   load.accept(()=>saved);
   setConflict(false);setReview(null);
   if(JSON.stringify(valueRef.current)!==JSON.stringify(captured))throw new Error("Your earlier details were saved. Newer changes are still unsaved.");
   setMessage("Saved locally.");
  }catch(reason){if(isEditConflict(reason)){setConflict(true);setReview(null);}setMessage(reason instanceof Error?reason.message:"Could not save these details.");throw reason;}
  finally{saving.current=false;setBusy(false);}
 };
 const guard=usePrayerDraftGuard({dirty,save,discard});
 const editable=load.data?.prayer.status==="ACTIVE"||load.data?.prayer.status==="WAITING";
 const change=(next:PrayerAdministrationValue)=>{valueRef.current=next;setValue(next);};
 const header=<JournalHeading title="Prayer settings" subtitle="People, rhythm & focus" back={load.data===null?safePrayerReturn(new URLSearchParams(location.search).get("return")):detailTarget}/>;
 if(load.data===undefined)return <main className="journal-workspace prayer-settings-journal">{header}{load.error?<div role="alert" className="journal-notice"><p>Could not open these settings. Your saved records are unchanged.</p><button onClick={load.retry}>Retry</button></div>:<p role="status">Opening prayer details…</p>}</main>;
 if(load.data===null)return <main className="journal-workspace prayer-settings-journal">{header}<p>This prayer is no longer available. It will not be recreated.</p>{dirty&&value?<SettingsComparison title="Your unsaved changes" value={value} metadata={metadata.data}/>:null}{guard.dialog}</main>;
 return <main className="journal-workspace prayer-settings-journal">{header}
  {!editable?<p className="journal-notice">This prayer is {load.data.prayer.status.toLowerCase()}. Its details are read-only.</p>:null}
  {value?<><div className="journal-paper prayer-settings-paper">
   <fieldset disabled={!editable} className="prayer-settings-section"><legend>People &amp; category</legend>
    <fieldset disabled={metadata.data===undefined||Boolean(metadata.error)} className="prayer-metadata-fields"><PrayerAdministrationFields section="people" value={value} people={metadata.data?.people??[]} categories={metadata.data?.categories??[]} onChange={change}/></fieldset>
    {metadata.error?<div role="alert"><p>People and categories could not load. Your existing selections are retained.</p><button onClick={metadata.retry}>Retry people and categories</button></div>:null}
    <div className="prayer-management-links"><Link to={"/prayer/people?"+new URLSearchParams({return:url})}>Manage people</Link><Link to={"/prayer/categories?"+new URLSearchParams({return:url})}>Manage categories</Link></div>
   </fieldset>
   <fieldset disabled={!editable} className="prayer-settings-section"><legend>When to pray</legend><PrayerAdministrationFields section="schedule" value={value} people={[]} categories={[]} onChange={change}/></fieldset>
   <fieldset disabled={!editable} className="prayer-settings-section"><legend>Dates &amp; focus</legend><PrayerAdministrationFields section="dates" value={value} people={[]} categories={[]} onChange={change}/></fieldset>
  </div>
  <div className="journal-actions prayer-settings-actions">{editable?<button className="grace-primary" disabled={busy||!dirty} onClick={()=>{void save().then(()=>{guard.allowNavigation();navigate(detailTarget,{replace:true});}).catch(()=>{});}}>{busy?"Saving…":"Save details"}</button>:null}<Link to={detailTarget}>Cancel</Link></div>
  <p className="journal-status" role="status">{message||(dirty?"Unsaved changes":"Saved locally")}</p>
  <p className="journal-help">Changes stay in memory until you save. Closing the app can discard unsaved changes.</p></>:null}
  {load.error?<div className="journal-notice" role="alert"><p>{load.error}</p><button onClick={load.retry}>Retry details</button></div>:null}
  {conflict&&value?<section className="journal-conflict"><h2>Review changed details</h2><p>Your changes are still here. Compare the saved version before choosing what to keep.</p>{reviewError?<p role="alert">{reviewError}</p>:null}
   {!review?<button onClick={()=>{void readPrayerSettings(db,prayerId).then(next=>{if(!next)throw new Error("This prayer is no longer available.");setReview(next);}).catch(reason=>setReviewError(reason.message));}}>Compare versions</button>:<>
    <div className="prayer-settings-comparison"><SettingsComparison title="Your changes" value={value} metadata={metadata.data}/><SettingsComparison title="Saved version" value={administrationValueFrom(review.prayer,review.schedule)} metadata={metadata.data}/></div>
    <button onClick={()=>{const next=administrationValueFrom(review.prayer,review.schedule);baseline.current={value:next,revision:review.prayer.revision};change(next);load.accept(()=>review);setConflict(false);setReview(null);setMessage("Saved details loaded.");}}>Use saved details</button>
    {(review.prayer.status==="ACTIVE"||review.prayer.status==="WAITING")?<button onClick={()=>{baseline.current={value:administrationValueFrom(review.prayer,review.schedule),revision:review.prayer.revision};load.accept(()=>review);setConflict(false);setReview(null);setMessage("Your changes are ready for an explicit save.");}}>Keep my changes for review</button>:null}
   </>}
  </section>:null}
  {guard.dialog}
 </main>;
}
function SettingsComparison({title,value,metadata}:{title:string;value:PrayerAdministrationValue;metadata:PrayerMetadata|undefined}){
 return <section className="prayer-settings-version"><h3>{title}</h3><dl>{comparison(value,metadata).map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl></section>;
}
