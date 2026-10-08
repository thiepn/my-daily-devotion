import type { MddDatabase } from "../data/database";
import type { WritingKind, SavedWriting, WritingRecords } from "./saved-types";
import { editableWriting, SavedVersionRepository, savedVersionTables, writingTables } from "./saved-versions";
import { isDraftReturnRoute } from "./validation";
import { parseRecoveryContext } from "./presentation";

export const VERSION_LABELS: Record<WritingKind, string> = { reflection: "Reflection", "prayer-wording": "Prayer wording", "verse-note": "Verse note", collection: "Collection", "collection-item": "Collection note", person: "Person details" };
export function validVersionTarget(value: string | null): string | null {
  if (!value) return null;
  const index = value.indexOf(":"), kind = value.slice(0,index), id = value.slice(index+1);
  return Object.hasOwn(writingTables,kind) && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id) ? value : null;
}
export function parseVersionContext(search: string) {
  return { ...parseRecoveryContext(search), target: validVersionTarget(new URLSearchParams(search).get("target")) };
}
export function savedVersionsUrl(id: string | null, returnTo: string, shown = 20, target: string | null = null) {
  const params = new URLSearchParams({view:"versions", return:isDraftReturnRoute(returnTo)?returnTo:"/data",shown:String(shown)});
  const checked=validVersionTarget(target); if(checked)params.set("target",checked);
  return `/recovery${id?`/versions/${encodeURIComponent(id)}`:""}?${params}`;
}
export function versionFields(writing: SavedWriting): {label:string;text:string}[] {
  switch(writing.kind) {
    case "reflection": case "verse-note": return [{label:"Writing",text:writing.bodyMd}];
    case "prayer-wording": return [{label:"Request",text:writing.body}];
    case "collection": return [{label:"Name",text:writing.name},{label:"Description",text:writing.description??""}];
    case "collection-item": return [{label:"Note",text:writing.note??""}];
    case "person": return [{label:"Name",text:writing.name},{label:"Relationship",text:writing.relationship??""},{label:"Notes",text:writing.notes??""}];
  }
}
export type VersionComparison = Awaited<ReturnType<typeof readVersionComparison>>;
export async function readVersionComparison(database: MddDatabase,id: string) {
  return database.transaction("r",[...savedVersionTables(database),database.reflections,database.prayers,database.verseNotes,database.collections,database.collectionItems,database.people],async()=>{
    const selected=await new SavedVersionRepository(database).read(id);
    if(selected.kind!=="available")return selected;
    const {metadata,contents}=selected;
    const current=await database.table(writingTables[metadata.kind]).get(metadata.targetId) as WritingRecords[WritingKind]|undefined;
    let reason=selected.previousJournal?"This version belongs to a previous journal. It can be copied, but cannot replace writing in this journal.":"";
    const live=current&&current.deletedAt===null?current:null;
    if(!live)reason=reason||"The original entry was removed or is unavailable. This version remains available for copying.";
    if(live&&metadata.kind==="prayer-wording"&&!["ACTIVE","WAITING"].includes((live as WritingRecords["prayer-wording"]).status))reason=reason||"Answered and archived prayer wording is read-only. You can copy this version.";
    if(live&&metadata.kind==="collection-item"){
      const parent=await database.collections.get((live as WritingRecords["collection-item"]).collectionId);
      if(!parent||parent.deletedAt)reason=reason||"The original collection is unavailable. You can copy this version.";
    }
    const currentWriting=live?editableWriting(metadata.kind,live):null;
    if(currentWriting?.kind==="reflection"&&contents.writing.kind==="reflection"&&currentWriting.localDate!==contents.writing.localDate||currentWriting?.kind==="verse-note"&&contents.writing.kind==="verse-note"&&JSON.stringify(currentWriting.reference)!==JSON.stringify(contents.writing.reference)||currentWriting?.kind==="collection-item"&&contents.writing.kind==="collection-item"&&(currentWriting.collectionId!==contents.writing.collectionId||JSON.stringify(currentWriting.reference)!==JSON.stringify(contents.writing.reference)))reason=reason||"The original date or Scripture relationship no longer matches. Keep this version for copying.";
    return {...selected,current:live,currentWriting,reason,fingerprint:JSON.stringify({metadata,contents}),same:currentWriting!==null&&JSON.stringify(currentWriting)===JSON.stringify(contents.writing)};
  });
}
