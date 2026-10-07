import {afterEach,expect,it,vi} from "vitest";
import {MddDatabase,prepareDatabase} from "../data/database";
import {PrayerRepository} from "../data/repositories/prayers";
import {DurableDraftController} from "./controller";
import {saveJournalDraft} from "./editor-adapters";
import type {DraftPayload} from "./types";
import {administrationValueFrom} from "../prayer/PrayerAdministrationFields";
const databases:MddDatabase[]=[],controllers:DurableDraftController[]=[];
afterEach(async()=>{for(const controller of controllers.splice(0))controller.detach();for(const database of databases.splice(0)){database.close();await database.delete();}});
async function setup(){const database=new MddDatabase("prayer-editor-"+crypto.randomUUID());databases.push(database);await prepareDatabase(database);const prayer=await new PrayerRepository(database).createPrayer({body:"Original request."});const controller=new DurableDraftController(database,{returnTo:"/prayer?status=ACTIVE&shown=15",reading:null});controllers.push(controller);return{database,prayer,controller,baseline:{id:prayer.id,revision:prayer.revision,status:prayer.status,body:prayer.body}};}
it.each(["prayer-update","prayer-encouragement","prayer-answer"] as const)("returns committed %s and retains exact action counts after replay",async kind=>{
 const {database,controller,baseline}=await setup();const payload:DraftPayload=kind==="prayer-answer"?{kind,body:"Kept writing",baseline,session:null}:{kind,body:"Kept writing",baseline};controller.stage(payload);await controller.flush();
 const result=await controller.commit(context=>saveJournalDraft(database,context));expect(result.prayer?.revision).toBe(2);
 if(kind==="prayer-answer"){expect(result.prayer?.status).toBe("ANSWERED");expect(result.resolution?.reflectionMd).toBe("Kept writing");}
 else {expect(result.update?.body).toBe("Kept writing");expect(result.update?.type).toBe(kind==="prayer-update"?"update":"encouragement");}
 const before=await Promise.all(database.tables.map(table=>table.toArray()));
 await expect(controller.commit(context=>saveJournalDraft(database,context))).rejects.toThrow();
 expect(await Promise.all(database.tables.map(table=>table.toArray()))).toEqual(before);expect(await database.activityEvents.count()).toBe(2);
});
it("unchanged wording performs no domain write and changed wording stays editable",async()=>{
 const {database,controller,baseline}=await setup();controller.stage({kind:"prayer-wording",body:baseline.body,baseline});
 const unchanged=await controller.commit(context=>saveJournalDraft(database,context));expect(unchanged.prayer?.revision).toBe(1);expect(unchanged.marker.disposition).toBe("editable");expect(await database.activityEvents.count()).toBe(1);
 await controller.discard();controller.stage({kind:"prayer-wording",body:"Revised wording.",baseline});
 const changed=await controller.commit(context=>saveJournalDraft(database,context));expect(changed.prayer?.revision).toBe(2);expect(changed.marker.disposition).toBe("editable");expect(await database.activityEvents.count()).toBe(1);
});
it("stale prayer revisions retain private writing without another update or resolution",async()=>{
 const {database,controller,baseline}=await setup();controller.stage({kind:"prayer-update",body:"Keep my update.",baseline});await controller.flush();
 await new PrayerRepository(database).updateBody(baseline.id,"Saved elsewhere.",baseline.revision);
 const before=await Promise.all(database.tables.map(table=>table.toArray()));
 await expect(controller.commit(context=>saveJournalDraft(database,context))).rejects.toMatchObject({code:"stale"});
 expect(await Promise.all(database.tables.map(table=>table.toArray()))).toEqual(before);expect(await database.prayerUpdates.count()).toBe(0);
});
it("classification keeps writing atomically under a new owner without recording either action",async()=>{
 const {database,controller,baseline}=await setup();controller.stage({kind:"prayer-update",body:"Keep this encouragement.",baseline});await controller.flush();const oldId=controller.getId();
 const before=await database.activityEvents.toArray();await controller.reclassifyUpdate("prayer-encouragement");const nextId=controller.getId();expect(nextId).not.toBe(oldId);
 expect((await database.editorDrafts.get(oldId!))?.state).toBe("discarded");expect(await database.editorDraftContents.get(oldId!)).toBeUndefined();
 expect((await database.editorDraftContents.get(nextId!))?.payload).toMatchObject({kind:"prayer-encouragement",body:"Keep this encouragement."});expect(await database.activityEvents.toArray()).toEqual(before);
 const saved=await controller.commit(context=>saveJournalDraft(database,context));expect(saved.update?.type).toBe("encouragement");expect(await database.prayerUpdates.count()).toBe(1);expect(await database.activityEvents.count()).toBe(2);
});
it("failed classification rolls back the transfer and preserves the acknowledged draft",async()=>{
 const {database,controller,baseline}=await setup();controller.stage({kind:"prayer-update",body:"Keep me after failure.",baseline});await controller.flush();
 const before=await Promise.all(database.tables.map(table=>table.toArray())),id=controller.getId();
 const original=database.editorDraftContents.put.bind(database.editorDraftContents);
 const stub=vi.spyOn(database.editorDraftContents,"put").mockImplementation(((row:any,...args:any[])=>{if(row.payload.kind==="prayer-encouragement")throw new Error("Private storage unavailable");return original(row,...args);}) as typeof database.editorDraftContents.put);
 try{await expect(controller.reclassifyUpdate("prayer-encouragement")).rejects.toThrow("Private storage unavailable");}finally{stub.mockRestore();}
 expect(controller.getId()).toBe(id);expect(await Promise.all(database.tables.map(table=>table.toArray()))).toEqual(before);
});
it("settings keep incomplete hidden values, save atomically and create no activity",async()=>{
 const {database,controller,baseline,prayer}=await setup();const original=administrationValueFrom(prayer,null);
 controller.stage({kind:"prayer-settings",administration:{...original,scheduleMode:"INTERVAL_DAYS",intervalDays:"",monthlyDay:"17"},baseline,schedule:null});await controller.flush();
 await expect(controller.commit(context=>saveJournalDraft(database,context))).rejects.toThrow();
 expect((await database.prayers.get(prayer.id))?.revision).toBe(1);expect(await database.prayerSchedules.count()).toBe(0);
 expect((await database.editorDraftContents.get(controller.getId()!))?.payload).toMatchObject({administration:{intervalDays:"",monthlyDay:"17"}});
 controller.stage({kind:"prayer-settings",administration:{...original,scheduleMode:"INTERVAL_DAYS",intervalDays:"5",monthlyDay:"17"},baseline,schedule:null});
 const result=await controller.commit(context=>saveJournalDraft(database,context));expect(result.prayer?.revision).toBe(2);expect(result.schedule?.intervalDays).toBe(5);expect(result.marker.disposition).toBe("editable");expect(await database.activityEvents.count()).toBe(1);
});
it("settings returning to their effective baseline create no domain revision",async()=>{
 const {database,controller,baseline,prayer}=await setup();const original=administrationValueFrom(prayer,null);
 controller.stage({kind:"prayer-settings",administration:{...original,monthlyDay:"17"},baseline,schedule:null});const result=await controller.commit(context=>saveJournalDraft(database,context));expect(result.prayer).toEqual(prayer);expect(result.schedule).toBeNull();expect(await database.prayerSchedules.count()).toBe(0);expect(await database.activityEvents.count()).toBe(1);
});
it("settings reject an independently changed schedule without losing their kept values",async()=>{
 const {database,controller,baseline,prayer}=await setup();const repository=new PrayerRepository(database);
 const current=await repository.updateAdministration(prayer.id,{personId:null,categoryId:null,eventDate:null,focusUntil:null,schedule:{mode:"DAILY"}},prayer.revision);const schedule=await repository.getScheduleForPrayer(current.id);
 const original=administrationValueFrom(current,schedule);controller.stage({kind:"prayer-settings",administration:{...original,scheduleMode:"MONTHLY",monthlyDay:"17"},baseline:{...baseline,revision:current.revision},schedule:{id:schedule!.id,revision:schedule!.revision,administration:original}});await controller.flush();
 await database.prayerSchedules.update(schedule!.id,{revision:schedule!.revision+1});const before=await Promise.all(database.tables.map(table=>table.toArray()));
 await expect(controller.commit(context=>saveJournalDraft(database,context))).rejects.toMatchObject({code:"stale"});expect(await Promise.all(database.tables.map(table=>table.toArray()))).toEqual(before);
});
it("reclassified recovered writing retires only its unchanged source on explicit save",async()=>{
 const {database,controller,baseline}=await setup();controller.stage({kind:"prayer-update",body:"A kept encouragement.",baseline});await controller.flush();const sourceId=controller.getId()!;
 const fork=new DurableDraftController(database,{returnTo:"/prayer",reading:null});controllers.push(fork);await fork.recover(sourceId,(await database.editorDrafts.get(sourceId))!.generation);
 await fork.reclassifyUpdate("prayer-encouragement");const result=await fork.commit(context=>saveJournalDraft(database,context));expect(result.update?.type).toBe("encouragement");expect((await database.editorDrafts.get(sourceId))?.state).toBe("committed");expect(await database.editorDraftContents.get(sourceId)).toBeUndefined();expect(await database.prayerUpdates.count()).toBe(1);
});
