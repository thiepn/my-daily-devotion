import type { MddDatabase } from "../data/database";
import { validateBackupRecords } from "../data/validation";
import { nowInstant } from "../domain/identity";
import type { MutableEntity } from "../domain/types";
import { readJournalEpoch } from "./journal";
import type { RemovalGroupMetadata, RemovalGroupContents, RemovalTable, RemovalRootTable } from "./saved-types";

export const REMOVAL_TABLES: RemovalTable[] = ["reflections","prayers","verseNotes","highlights","bookmarks","collections","collectionItems","people","categories","scriptureLinks","prayerUpdates","prayerResolutions","prayerSchedules"];
export const REMOVAL_LABELS: Record<RemovalRootTable,string> = {reflections:"Reflection",prayers:"Prayer",verseNotes:"Verse note",highlights:"Highlight",bookmarks:"Bookmark",collections:"Collection",collectionItems:"Collection passage",people:"Person",categories:"Category"};
const fields: Record<RemovalTable,string[]> = {
 reflections:["localDate","bodyMd","devotionDayId"], prayers:["body","status","personId","categoryId","scheduleId","eventDate","focusUntil","sourceReflectionId","sourceDevotionDate","lastPrayedAt","archivedAt"],
 verseNotes:["translationId","startVerseKey","endVerseKey","bodyMd"],highlights:["translationId","startVerseKey","endVerseKey","style"],bookmarks:["translationId","startVerseKey","endVerseKey","label"],
 collections:["name","description","sortOrder"],collectionItems:["translationId","startVerseKey","endVerseKey","collectionId","note","sortOrder"],people:["name","relationship","notes"],categories:["name","sortOrder"],
 scriptureLinks:["translationId","startVerseKey","endVerseKey","ownerType","ownerId"],prayerUpdates:["prayerId","type","body","occurredAt"],prayerResolutions:["prayerId","answeredAt","reflectionMd"],prayerSchedules:["mode","weekdays","intervalDays","monthlyDay","onDate","anchorDate"]
};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const uuid=(value:unknown)=>typeof value==="string"&&/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const exact=(value:Record<string,unknown>,names:string[])=>Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
const instant=(value:unknown)=>typeof value==="string"&&/^\d{4}-\d\d-\d\dT.*Z$/.test(value)&&Number.isFinite(Date.parse(value));
export function removalTables(db:MddDatabase){return [...REMOVAL_TABLES.map(name=>db.table(name)),db.removalGroups,db.removalGroupContents,db.draftJournalState,db.devotionDays,db.activityEvents];}
export function isRemovalMetadata(value:unknown):value is RemovalGroupMetadata {
 if(!object(value)||!exact(value,["id","formatVersion","journalEpoch","removedAt","expiresAt","state","rootTable","rootId","affected"])||!uuid(value.id)||value.formatVersion!==1||!uuid(value.journalEpoch)||!instant(value.removedAt)||!instant(value.expiresAt)||Date.parse(String(value.expiresAt))-Date.parse(String(value.removedAt))!==30*86400000||!["available","restored","expired"].includes(String(value.state))||!Object.hasOwn(REMOVAL_LABELS,String(value.rootTable))||!uuid(value.rootId)||!Array.isArray(value.affected)||!value.affected.length||value.affected.length>100_000)return false;
 const keys=new Set<string>();return value.affected.every(item=>{
  if(!object(item)||!exact(item,["table","id","beforeRevision","afterRevision"])||!REMOVAL_TABLES.includes(item.table as RemovalTable)||!uuid(item.id)||!Number.isSafeInteger(item.beforeRevision)||Number(item.beforeRevision)<1||item.afterRevision!==Number(item.beforeRevision)+1)return false;
  const key=`${item.table}:${item.id}`;if(keys.has(key))return false;keys.add(key);return true;
 })&&keys.has(`${value.rootTable}:${value.rootId}`);
}
export function isRemovalContents(value:unknown):value is RemovalGroupContents {
 if(!object(value)||!exact(value,["id","formatVersion","records"])||!uuid(value.id)||value.formatVersion!==1||!Array.isArray(value.records)||!value.records.length||value.records.length>100_000)return false;
 try{const keys=new Set<string>();for(const item of value.records){
  if(!object(item)||!exact(item,["table","record"])||!REMOVAL_TABLES.includes(item.table as RemovalTable)||!object(item.record))return false;
  const row=item.record,table=item.table as RemovalTable;
  if(!exact(row,["id","createdAt","updatedAt","revision","deletedAt",...fields[table]])||!uuid(row.id)||row.deletedAt!==null||Object.entries(row).some(([key,field])=>typeof field==="string"&&(field.length>1_000_000||["devotionDayId","personId","categoryId","scheduleId","sourceReflectionId","collectionId","ownerId","prayerId"].includes(key)&&!uuid(field))))return false;
  validateBackupRecords({[table]:[row]});const key=`${table}:${row.id}`;if(keys.has(key))return false;keys.add(key);
 }return true;}catch{return false;}
}
/** Snapshot the existing cascade, then retain only rows actually tombstoned by it. */
export async function withRemovalCapture<T>(db:MddDatabase,root:()=>Promise<{table:RemovalRootTable;id:string}|null>,action:()=>Promise<T>):Promise<T>{
 return db.transaction("rw",removalTables(db),async()=>{
  const target=await root();const candidates:RemovalGroupContents["records"]=[];
  if(target){const parent=await db.table(target.table).get(target.id);if(parent&&parent.deletedAt===null){
   candidates.push({table:target.table,record:parent} as RemovalGroupContents["records"][number]);
   const add=async(table:RemovalTable,index:string,key:string|string[],filter?:(row:Record<string,unknown>)=>boolean)=>{const rows=await db.table(table).where(index).equals(key).filter(row=>row.deletedAt===null&&(!filter||filter(row))).toArray();for(const record of rows)candidates.push({table,record} as RemovalGroupContents["records"][number]);};
   if(target.table==="reflections")await add("scriptureLinks","[ownerType+ownerId]",["reflection",parent.id]);
   if(target.table==="collections")await add("collectionItems","collectionId",parent.id);
   if(target.table==="prayers"){await add("prayerUpdates","prayerId",parent.id);await add("prayerResolutions","prayerId",parent.id);await add("scriptureLinks","[ownerType+ownerId]",["prayer",parent.id]);if(parent.scheduleId){const schedule=await db.prayerSchedules.get(parent.scheduleId);if(schedule&&schedule.deletedAt===null)candidates.push({table:"prayerSchedules",record:schedule});}}
  }}
  const result=await action();
  const changed:RemovalGroupContents["records"]=[],affected:RemovalGroupMetadata["affected"]=[];
  for(const item of candidates){const next=await db.table(item.table).get(item.record.id);if(next?.deletedAt&&next.revision===item.record.revision+1){changed.push(item);affected.push({table:item.table,id:item.record.id,beforeRevision:item.record.revision,afterRevision:next.revision});}}
  if(target&&affected.some(item=>item.table===target.table&&item.id===target.id)){
   const removedAt=nowInstant(),id=crypto.randomUUID();
   const metadata:RemovalGroupMetadata={id,formatVersion:1,journalEpoch:await readJournalEpoch(db),removedAt,expiresAt:new Date(Date.parse(removedAt)+30*86400000).toISOString(),state:"available",rootTable:target.table,rootId:target.id,affected};
   const contents:RemovalGroupContents={id,formatVersion:1,records:changed};
   if(!isRemovalPair(metadata,contents))throw new Error("This removal could not be safely retained for recovery. Nothing was removed.");
   await db.removalGroups.add(metadata);await db.removalGroupContents.add(contents);
  }return result;
 });
}
export async function readRemoval(db:MddDatabase,id:string){return db.transaction("r",[...removalTables(db)],async()=>{
 const metadata=await db.removalGroups.get(id),contents=await db.removalGroupContents.get(id);
 if(!metadata)return {kind:"missing" as const};
 if(!isRemovalPair(metadata,contents)||!isRemovalContents(contents))return {kind:"invalid" as const};
 return {kind:"available" as const,metadata,contents,previousJournal:metadata.journalEpoch!==await readJournalEpoch(db),fingerprint:JSON.stringify({metadata,contents})};
});}
export function isRemovalPair(metadata:unknown,contents:unknown):metadata is RemovalGroupMetadata {
 if(!isRemovalMetadata(metadata)||!isRemovalContents(contents)||metadata.id!==contents.id||metadata.affected.length!==contents.records.length)return false;
 const records=new Map(contents.records.map(item=>[`${item.table}:${item.record.id}`,item.record]));
 if(metadata.affected.some(item=>records.get(`${item.table}:${item.id}`)?.revision!==item.beforeRevision))return false;
 const root=contents.records.find(item=>item.table===metadata.rootTable&&item.record.id===metadata.rootId)!.record as unknown as Record<string,unknown>;
 return contents.records.every(item=>{
  if(item.table===metadata.rootTable&&item.record.id===metadata.rootId)return true;
  const row=item.record as unknown as Record<string,unknown>;
  if(metadata.rootTable==="collections")return item.table==="collectionItems"&&row.collectionId===metadata.rootId;
  if(metadata.rootTable==="reflections")return item.table==="scriptureLinks"&&row.ownerType==="reflection"&&row.ownerId===metadata.rootId;
  if(metadata.rootTable==="prayers")return ["prayerUpdates","prayerResolutions"].includes(item.table)&&row.prayerId===metadata.rootId||item.table==="scriptureLinks"&&row.ownerType==="prayer"&&row.ownerId===metadata.rootId||item.table==="prayerSchedules"&&root.scheduleId===row.id;
  return false;
 });
}
export type RestoreRemovalResult={kind:"committed";records:RemovalGroupContents["records"]}|{kind:"unchanged"}|{kind:"conflict"|"unavailable"|"expired"|"failed";reason:string};
export async function restoreRemoval(db:MddDatabase,id:string,fingerprint:string,at:string=nowInstant()):Promise<RestoreRemovalResult>{
 if(!instant(at))return {kind:"unavailable",reason:"A valid device time is required before restoring."};
 try{return await db.transaction("rw",removalTables(db),async():Promise<RestoreRemovalResult>=>{
  const reviewed=await readRemoval(db,id);if(reviewed.kind!=="available"||reviewed.previousJournal)return {kind:"unavailable",reason:"This removal is unavailable or belongs to a previous journal. Its writing can still be copied."};
  const {metadata,contents}=reviewed;if(metadata.state==="restored")return {kind:"unchanged"};
  if(reviewed.fingerprint!==fingerprint)return {kind:"conflict",reason:"This recovery entry changed. Review it again."};
  if(metadata.state==="expired"||Date.parse(at)>=Date.parse(metadata.expiresAt))return {kind:"expired",reason:"The original thirty-day recovery window has ended. Retained writing can be copied."};
  if(Date.parse(at)<Date.parse(metadata.removedAt))return {kind:"unavailable",reason:"The device clock is earlier than this removal. Check the clock before restoring."};
  const proposed=new Map(contents.records.map(item=>[`${item.table}:${item.record.id}`,item.record]));
  const live=async(table:RemovalTable|"devotionDays",key:string|null)=>{if(!key)return null;const row=proposed.get(`${table}:${key}`)??await db.table(table).get(key);return row&&row.deletedAt===null?row:null;};
  for(const item of metadata.affected){
   const row=await db.table(item.table).get(item.id),original=proposed.get(`${item.table}:${item.id}`)!;
   if(!row||row.deletedAt===null||row.revision!==item.afterRevision||Object.keys(original).some(key=>!["revision","updatedAt","deletedAt"].includes(key)&&JSON.stringify(row[key])!==JSON.stringify((original as unknown as Record<string,unknown>)[key])))return {kind:"conflict",reason:"A removed entry changed after this removal. It cannot be overwritten."};
  }
  for(const item of contents.records){const row=item.record;
   if(item.table==="reflections"){const value=row as import("../domain/types").Reflection;if(!await live("devotionDays",value.devotionDayId))return {kind:"conflict",reason:"The original devotional day is unavailable."};if(await db.reflections.where("localDate").equals(value.localDate).filter(other=>other.deletedAt===null&&other.id!==value.id).count())return {kind:"conflict",reason:"Another reflection occupies this date."};}
   if(["verseNotes","highlights","bookmarks"].includes(item.table)){const value=row as import("../domain/types").ScriptureReference&MutableEntity;if(await db.table(item.table).where("translationId").equals(value.translationId).filter(other=>other.deletedAt===null&&other.id!==value.id&&other.startVerseKey===value.startVerseKey&&other.endVerseKey===value.endVerseKey).count())return {kind:"conflict",reason:"Another saved entry occupies this Scripture range."};}
   if(item.table==="collectionItems"){
    const value=row as import("../domain/types").CollectionItem;
    if(!await live("collections",value.collectionId))return {kind:"conflict",reason:"Restore the parent collection first."};
    if(await db.collectionItems.where("collectionId").equals(value.collectionId).filter(other=>other.deletedAt===null&&other.id!==value.id&&other.translationId===value.translationId&&other.startVerseKey===value.startVerseKey&&other.endVerseKey===value.endVerseKey).count())return {kind:"conflict",reason:"This passage is already saved in the collection."};
   }
   if(item.table==="categories"&&await db.categories.filter(other=>other.deletedAt===null&&other.id!==row.id&&other.name.toLocaleLowerCase()===(row as import("../domain/types").Category).name.toLocaleLowerCase()).count())return {kind:"conflict",reason:"A category with this name already exists."};
   if(item.table==="prayers"){const value=row as import("../domain/types").Prayer;for(const [table,key] of [["people",value.personId],["categories",value.categoryId],["prayerSchedules",value.scheduleId]] as const)if(key&&!await live(table,key))return {kind:"conflict",reason:"Restore this prayer’s original person, category or schedule first."};if(value.sourceReflectionId&&!await db.reflections.get(value.sourceReflectionId))return {kind:"conflict",reason:"The source reflection record is unavailable."};}
   if(item.table==="prayerUpdates"||item.table==="prayerResolutions"){if(!await live("prayers",(row as import("../domain/types").PrayerUpdate).prayerId))return {kind:"conflict",reason:"The parent prayer is unavailable."};}
   if(item.table==="scriptureLinks"){const link=row as import("../domain/types").ScriptureLink;const table={reflection:"reflections",prayer:"prayers",prayerUpdate:"prayerUpdates",verseNote:"verseNotes"}[link.ownerType] as RemovalTable;if(!await live(table,link.ownerId))return {kind:"conflict",reason:"A Scripture link’s original owner is unavailable."};}
   if(item.table==="people"||item.table==="categories"){if(await db.prayers.where(item.table==="people"?"personId":"categoryId").equals(row.id).filter(prayer=>prayer.deletedAt===null).count())return {kind:"conflict",reason:"A prayer was assigned to this removed entry. Review that assignment first."};}
  }
  const restored:RemovalGroupContents["records"]=[];
  for(const item of contents.records){const tombstone=await db.table(item.table).get(item.record.id);const record={...item.record,deletedAt:null,updatedAt:at,revision:tombstone.revision+1};await db.table(item.table).put(record);restored.push({table:item.table,record} as RemovalGroupContents["records"][number]);}
  await db.removalGroups.put({...metadata,state:"restored"});return {kind:"committed",records:restored};
 });}catch{return {kind:"failed",reason:"The removal could not be restored. No records were changed; keep this recovery copy and retry."};}
}
