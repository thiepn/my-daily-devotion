import {expect,test} from "@playwright/test";
import {seedPrayerDetail,detailRoute} from "./prayer-detail-fixture";
import {writingSnapshot} from "./writing-fixture";
import {openRoute,expectNoAxeViolations} from "./helpers";
const panel=(page:import("@playwright/test").Page)=>page.locator(".prayer-record-editor");
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const kind of ["wording","update","encouragement","answer"] as const){
 test(`acknowledged ${kind} writing survives restart and recovery records no action`,async({page})=>{
  await seedPrayerDetail(page);
  if(kind==="wording")await page.getByRole("button",{name:"Edit wording",exact:true}).click();
  else if(kind==="answer")await page.locator(".prayer-record-actions").getByRole("button",{name:"Mark answered",exact:true}).click();
  else {await page.locator(".prayer-record-actions").getByRole("button",{name:"Add update",exact:true}).click();if(kind==="encouragement")await panel(page).getByRole("button",{name:"Encouragement",exact:true}).click();}
  const before=await writingSnapshot(page);
  await page.locator("#prayer-record-writing").fill("Keep this unfinished writing.");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.reload();await expect(panel(page)).toHaveCount(0);
  await openRoute(page,"/recovery");await page.getByRole("link",{name:kind==="answer"?/Answer note/:kind==="encouragement"?/Encouragement/:kind==="wording"?/Prayer wording/:/Prayer update/}).click();
  await page.getByRole("link",{name:"Review in Prayer",exact:true}).click();await page.getByRole("button",{name:"Recover for review",exact:true}).click();
  await expect(page.locator("#prayer-record-writing")).toHaveValue("Keep this unfinished writing.");
  const recovered=await writingSnapshot(page);
  expect(recovered.filter((row:any)=>!["editorDrafts","editorDraftContents","draftJournalState"].includes(row[0]))).toEqual(before.filter((row:any)=>!["editorDrafts","editorDraftContents","draftJournalState"].includes(row[0])));
  await panel(page).getByRole("button",{name:kind==="wording"?"Save wording":kind==="answer"?"Mark answered":kind==="encouragement"?"Add encouragement":"Add update",exact:true}).click();
  await expect(page.locator(".journal-status")).toHaveText("Saved locally.");
  const after=Object.fromEntries(await writingSnapshot(page) as any), earlier=Object.fromEntries(before as any);
  expect(after.activityEvents.length-earlier.activityEvents.length).toBe(kind==="wording"?0:1);expect(after.prayers[0].revision).toBe(2);
  if(kind==="wording")expect(after.prayers[0].body).toBe("Keep this unfinished writing.");
  else if(kind==="answer"){expect(after.prayers[0].status).toBe("ANSWERED");expect(after.prayerResolutions[0].reflectionMd).toBe("Keep this unfinished writing.");}
  else expect(after.prayerUpdates.some((entry:any)=>entry.body==="Keep this unfinished writing."&&entry.type===kind)).toBe(true);
  await expectNoAxeViolations(page);
 });
}
test("opening every pristine prayer editor is write-free, including an optional empty answer",async({page})=>{
 await seedPrayerDetail(page);const before=await writingSnapshot(page);
 await page.getByRole("button",{name:"Edit wording",exact:true}).click();await panel(page).getByRole("button",{name:"Cancel editing",exact:true}).click();
 await page.locator(".prayer-record-actions").getByRole("button",{name:"Add update",exact:true}).click();await panel(page).getByRole("button",{name:"Encouragement",exact:true}).click();await panel(page).getByRole("button",{name:"Cancel editing",exact:true}).click();
 await page.locator(".prayer-record-actions").getByRole("button",{name:"Mark answered",exact:true}).click();await panel(page).getByRole("button",{name:"Cancel editing",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Discard and continue",exact:true}).click();
 expect(await writingSnapshot(page)).toEqual(before);await expect(page).toHaveURL(new RegExp(detailRoute.split("?")[0]));
});
for(const kind of ["update","answer"] as const)test(`newer ${kind} text stays copyable after one recorded action`,async({page})=>{
 await seedPrayerDetail(page);await page.locator(".prayer-record-actions").getByRole("button",{name:kind==="update"?"Add update":"Mark answered",exact:true}).click();await page.locator("#prayer-record-writing").fill("Submitted writing.");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
 await page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("my-daily-devotion");request.onsuccess=()=>resolve(request.result);});
  const tx=database.transaction("prayers","readwrite");(window as any).releaseDraftAction=false;
  const keep=()=>{const request=tx.objectStore("prayers").get("unused");request.onsuccess=()=>{if(!(window as any).releaseDraftAction)keep();};};keep();tx.oncomplete=()=>database.close();
 });
 await panel(page).getByRole("button",{name:kind==="update"?"Add update":"Mark answered",exact:true}).click();await expect(page.locator(".save-state")).toHaveText("Saving…");
 await page.locator("#prayer-record-writing").evaluate((node:HTMLTextAreaElement)=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(node,"Submitted writing. Newer queued text.");node.dispatchEvent(new Event("input",{bubbles:true}));});await page.evaluate(()=>{(window as any).releaseDraftAction=true;});
 await expect(page.locator(".journal-status")).toContainText("Copy your newer writing");await expect(page.locator("#prayer-record-writing")).toHaveValue("Submitted writing. Newer queued text.");await expect(page.locator(".draft-status")).toContainText("Action already recorded");
 await expect(panel(page).getByRole("button",{name:kind==="update"?"Add update":"Mark answered",exact:true})).toBeDisabled();
 const rows=Object.fromEntries(await writingSnapshot(page) as any);expect(rows.activityEvents).toHaveLength(1);expect(rows.prayers[0].revision).toBe(2);expect(rows.editorDraftContents[0].payload.body).toBe("Submitted writing. Newer queued text.");
 if(kind==="answer")expect(rows.prayerResolutions).toHaveLength(1);else expect(rows.prayerUpdates.filter((item:any)=>item.body==="Submitted writing.")).toHaveLength(1);
});
