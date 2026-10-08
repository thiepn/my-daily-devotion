import type {MddDatabase} from "../data/database";
import {PrayerSessionRepository,type PrayerSessionState} from "../data/repositories/prayer-sessions";
import {saveWithDraft,type DraftSaveContext} from "./commit";
import {DraftError} from "./types";

/** Only the identified pending item may be answered. Recovery/preview uses
 * readState separately; this adapter is invoked by explicit Mark answered. */
export async function saveFocusedPrayerDraft(database:MddDatabase,context:DraftSaveContext){
 const payload=context.snapshot.contents.payload;
 if(payload.kind!=="prayer-answer"||!payload.session)throw new DraftError("invalid","This writing does not identify a saved prayer session.");
 const sessions=new PrayerSessionRepository(database);
 let state:PrayerSessionState|undefined;
 const result=await saveWithDraft(database,context,{
  tables:["prayerSessions","prayerSessionItems","prayers","prayerResolutions","activityEvents"],
  validate:async submitted=>{
   if(submitted.kind!=="prayer-answer"||!submitted.session)throw new DraftError("invalid","Missing session context.");
   const session=await database.prayerSessions.get(submitted.session.id),item=await database.prayerSessionItems.get(submitted.session.itemId),prayer=await database.prayers.get(submitted.baseline.id);
   if(!session||session.deletedAt||session.endedAt||session.localDate!==submitted.session.localDate||!item||item.deletedAt||item.sessionId!==session.id||item.prayerId!==submitted.baseline.id||item.outcome!==null)throw new DraftError("stale","This request is no longer pending in its original session. Keep your note for copying.");
   if(!prayer||prayer.deletedAt||prayer.status!=="ACTIVE"||prayer.revision!==submitted.baseline.revision)throw new DraftError("stale","This prayer changed or was removed. Review it before recording an answer.");
  },
  save:async submitted=>{
   if(submitted.kind!=="prayer-answer"||!submitted.session)throw new DraftError("invalid","Missing session context.");
   const session=(await database.prayerSessions.get(submitted.session.id))!,item=(await database.prayerSessionItems.get(submitted.session.itemId))!;
   const saved=await sessions.answer(session.id,item.id,submitted.body,undefined,{session:session.revision,item:item.revision,prayer:submitted.baseline.revision});state=saved.state;
   const savedItem=state.entries.find(entry=>entry.item.id===item.id)!;
   return{records:[{id:state.session.id,revision:state.session.revision},{id:savedItem.item.id,revision:savedItem.item.revision},{id:savedItem.prayer!.id,revision:savedItem.prayer!.revision}],disposition:"copy-only"};
  },
 });
 // Replaying a committed operation never re-answers or reconciles. A readonly
 // reload can fail independently while the committed marker remains truthful.
 if(result.replayed)state=await sessions.readState(payload.session.id).catch(()=>undefined);
 return{...result,state};
}
