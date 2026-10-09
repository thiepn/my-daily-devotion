import {afterEach,expect,it} from "vitest";
import {MddDatabase,prepareDatabase} from "../data/database";
import {PrayerRepository} from "../data/repositories/prayers";
import {PrayerSessionRepository} from "../data/repositories/prayer-sessions";
import {DurableDraftController} from "./controller";
import {saveFocusedPrayerDraft} from "./session-adapter";
import type {DraftPayload} from "./types";
const databases:MddDatabase[]=[],controllers:DurableDraftController[]=[];
afterEach(async()=>{for(const item of controllers.splice(0))item.detach();for(const database of databases.splice(0)){database.close();await database.delete();}});
async function setup(){const database=new MddDatabase("session-draft-"+crypto.randomUUID());databases.push(database);await prepareDatabase(database);const prayer=await new PrayerRepository(database).createPrayer({body:"A real request."});const sessions=new PrayerSessionRepository(database),state=(await sessions.startOrResume("quick","2026-04-24"))!,item=state.entries[0]!.item;const controller=new DurableDraftController(database,{returnTo:"/prayer/session?session="+state.session.id,reading:null});controllers.push(controller);const payload:Extract<DraftPayload,{kind:"prayer-answer"}>={kind:"prayer-answer",body:"An unfinished answer.",baseline:{id:prayer.id,revision:prayer.revision,status:prayer.status,body:prayer.body},session:{id:state.session.id,itemId:item.id,localDate:state.session.localDate}};controller.stage(payload);await controller.flush();return{database,sessions,state,item,controller,payload};}
it("keeps and recovers a session answer without touching the frozen queue",async()=>{
 const {database,state,controller}=await setup();const before=await Promise.all([database.prayers.toArray(),database.prayerSessions.toArray(),database.prayerSessionItems.toArray(),database.activityEvents.toArray()]);
 const fork=new DurableDraftController(database,{returnTo:"/prayer",reading:null});controllers.push(fork);const kept=await database.editorDrafts.get(controller.getId()!);const recovered=await fork.recover(kept!.id,kept!.generation);expect(recovered).toMatchObject({session:{id:state.session.id,localDate:"2026-04-24"}});
 expect(await Promise.all([database.prayers.toArray(),database.prayerSessions.toArray(),database.prayerSessionItems.toArray(),database.activityEvents.toArray()])).toEqual(before);
});
it("answers and retires only the submitted generation atomically",async()=>{
 const {database,controller}=await setup();const result=await controller.commit(context=>saveFocusedPrayerDraft(database,context));expect(result.marker.disposition).toBe("copy-only");expect(result.state?.entries[0]?.item.outcome).toBe("ANSWERED");expect(result.state?.entries[0]?.prayer?.status).toBe("ANSWERED");expect(await database.prayerResolutions.count()).toBe(1);expect(await database.activityEvents.count()).toBe(2);expect(await database.editorDraftContents.count()).toBe(0);
 const before=await Promise.all(database.tables.map(table=>table.toArray()));await expect(controller.commit(context=>saveFocusedPrayerDraft(database,context))).rejects.toThrow();expect(await Promise.all(database.tables.map(table=>table.toArray()))).toEqual(before);
});
it.each(["ended","skipped","changed","wrong-date"] as const)("rejects %s session context while retaining its acknowledged note",async scenario=>{
 const {database,sessions,state,item,controller,payload}=await setup();
 if(scenario==="ended")await sessions.endSession(state.session.id);
 else if(scenario==="skipped")await sessions.skip(state.session.id,item.id);
 else if(scenario==="changed")await new PrayerRepository(database).updateBody(payload.baseline.id,"Changed in another tab.",payload.baseline.revision);
 else {controller.stage({...payload,session:{...payload.session!,localDate:"2026-04-25"}});await controller.flush();}
 const before=await Promise.all(database.tables.map(table=>table.toArray()));await expect(controller.commit(context=>saveFocusedPrayerDraft(database,context))).rejects.toMatchObject({code:"stale"});expect(await Promise.all(database.tables.map(table=>table.toArray()))).toEqual(before);expect(await database.prayerResolutions.count()).toBe(0);
});
