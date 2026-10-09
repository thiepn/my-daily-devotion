import type { Category, Person, Prayer, PrayerResolution, PrayerSchedule, PrayerUpdate, Reflection, ScriptureLink } from "../domain/types";
import type { MddDatabase } from "../data/database";
export interface PrayerTimelineEntry { id:string; kind:"update"|"encouragement"|"answer"; at:string; body:string; }
export interface PrayerDetailModel { prayer:Prayer; updates:PrayerUpdate[]; resolution:PrayerResolution|null; links:ScriptureLink[]; source:Reflection|null; }
export interface PrayerMetadata { people:Person[]; categories:Category[]; }
export function prayerTimeline(model:PrayerDetailModel):PrayerTimelineEntry[] {
 const rows:PrayerTimelineEntry[]=model.updates.filter(item=>!item.deletedAt).map(item=>({id:"update:"+item.id,kind:item.type,at:item.occurredAt,body:item.body}));
 if(model.resolution&&!model.resolution.deletedAt)rows.push({id:"answer:"+model.resolution.id,kind:"answer",at:model.resolution.answeredAt,body:model.resolution.reflectionMd??""});
 return rows.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
export function readPrayerDetail(db:MddDatabase,id:string):Promise<PrayerDetailModel|null> {
 return db.transaction("r",db.prayers,db.prayerUpdates,db.prayerResolutions,db.scriptureLinks,db.reflections,async()=>{
  const prayer=await db.prayers.get(id);if(!prayer||prayer.deletedAt)return null;
  const [updates,resolutions,links,source]=await Promise.all([
   db.prayerUpdates.where("prayerId").equals(id).filter(item=>!item.deletedAt).toArray(),
   db.prayerResolutions.where("prayerId").equals(id).filter(item=>!item.deletedAt).toArray(),
   db.scriptureLinks.where("[ownerType+ownerId]").equals(["prayer",id]).filter(item=>!item.deletedAt).toArray(),
   prayer.sourceReflectionId?db.reflections.get(prayer.sourceReflectionId):Promise.resolve(undefined)
  ]);
  return {prayer,updates,resolution:resolutions.sort((a,b)=>b.answeredAt.localeCompare(a.answeredAt)||a.id.localeCompare(b.id))[0]??null,links,source:source&&!source.deletedAt?source:null};
 });
}
export function readPrayerMetadata(db:MddDatabase):Promise<PrayerMetadata>{
 return db.transaction("r",db.people,db.categories,async()=>({
  people:(await db.people.filter(item=>!item.deletedAt).toArray()).sort((a,b)=>a.name.localeCompare(b.name)),
  categories:(await db.categories.filter(item=>!item.deletedAt).toArray()).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name))
 }));
}
export function readPrayerSettings(db:MddDatabase,id:string):Promise<{prayer:Prayer;schedule:PrayerSchedule|null}|null>{
 return db.transaction("r",db.prayers,db.prayerSchedules,async()=>{
  const prayer=await db.prayers.get(id);if(!prayer||prayer.deletedAt)return null;
  const schedule=prayer.scheduleId?await db.prayerSchedules.get(prayer.scheduleId):null;
  return {prayer,schedule:schedule&&!schedule.deletedAt?schedule:null};
 });
}
export interface PrayerDetailQuery { entry:string|null; shown:number; returnTo:string; search:string; draft:string|null; edit:"wording"|"update"|"encouragement"|"answer"|null; }
export function safePrayerReturn(value:string|null,fallback="/prayer"):string{
 return value?.startsWith("/")&&!value.startsWith("//")&&!/[\\\\\u0000-\u001f]/.test(value)?value:fallback;
}
export function parsePrayerDetailQuery(search:string):PrayerDetailQuery{
 const params=new URLSearchParams(search);const rawEntry=params.get("entry"),rawShown=params.get("shown");
 const rawDraft=params.get("draft"),rawEdit=params.get("edit");
 const draft=rawDraft&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDraft)?rawDraft:null;
 const edit=rawEdit&&["wording","update","encouragement","answer"].includes(rawEdit)?rawEdit as PrayerDetailQuery["edit"]:null;
 if(rawDraft!==null&&!draft)params.delete("draft");if(rawEdit!==null&&!edit)params.delete("edit");
 const entry=rawEntry&&/^(update|answer):[a-zA-Z0-9_-]+$/.test(rawEntry)?rawEntry:null;
 const count=rawShown&&/^\d+$/.test(rawShown)?Number(rawShown):20;
 const rounded=Math.ceil(count/20)*20;
 const shown=Number.isSafeInteger(rounded)&&count>=20?rounded:20;
 if(rawEntry!==null&&!entry)params.delete("entry");
 if(rawShown!==null) {if(shown===20)params.delete("shown");else params.set("shown",String(shown));}
 const returnTo=safePrayerReturn(params.get("return"));if(params.has("return")&&returnTo!==params.get("return"))params.delete("return");
 return {entry,shown,returnTo,draft,edit,search:params.size?"?"+params.toString():""};
}
export function prayerDetailUrl(id:string,returnTo?:string,entry?:string):string {
 const params=new URLSearchParams();if(returnTo)params.set("return",safePrayerReturn(returnTo));if(entry)params.set("entry",entry);
 return "/prayer/"+encodeURIComponent(id)+(params.size?"?"+params.toString():"");
}
