import {expect,test,type Page} from "@playwright/test";
import {seedPrayerDetail} from "../ux/prayer-detail-fixture";
import {expectNoHorizontalOverflow,expectNoAxeViolations} from "../ux/helpers";
type Kind="wording"|"update"|"encouragement"|"answer";
const writing="Give me patience in this season, and help me notice the quiet encouragement along the way.";
async function openEditor(page:Page,kind:Kind){
 if(kind==="wording")await page.getByRole("button",{name:"Edit wording",exact:true}).click();
 else if(kind==="answer")await page.locator(".prayer-record-actions").getByRole("button",{name:"Mark answered",exact:true}).click();
 else {await page.locator(".prayer-record-actions").getByRole("button",{name:"Add update",exact:true}).click();if(kind==="encouragement")await page.locator(".prayer-record-editor").getByRole("button",{name:"Encouragement",exact:true}).click();}
}
async function settle(page:Page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));window.scrollTo({top:0,behavior:"instant"});});await page.mouse.move(0,0);}
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const kind of ["wording","update","encouragement","answer"] as const)for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]){
 test(`Prayer ${kind} recovery ${width}`,async({page})=>{
  await page.setViewportSize({width,height});await seedPrayerDetail(page);await openEditor(page,kind);await page.locator("#prayer-record-writing").fill(writing);await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.reload();await openEditor(page,kind);await page.getByText("Kept drafts for this editor",{exact:true}).click();await expectNoHorizontalOverflow(page);await settle(page);
  await expect(page).toHaveScreenshot(`prayer-writing-${kind}-${width}.png`,{fullPage:true});
 });
}
for(const state of ["dark","text200","review","kept","storage-failure","long-writing","discard","conflict"]){
 test("Prayer writing recovery "+state,async({page})=>{
  await page.setViewportSize({width:state==="text200"?320:390,height:844});if(state==="dark")await page.emulateMedia({colorScheme:"dark"});
  await seedPrayerDetail(page);await openEditor(page,state==="conflict"?"wording":"update");
  if(state==="storage-failure")await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="editorDraftContents")throw new DOMException("Private storage unavailable","QuotaExceededError");return original.apply(this,args);};});
  await page.locator("#prayer-record-writing").fill(state==="long-writing"?(writing+"\n\n").repeat(30):writing);
  if(state==="storage-failure")await expect(page.getByRole("alert")).toContainText("Draft could not be kept");else await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  if(state==="review"){await page.reload();await openEditor(page,"update");await page.getByText("Kept drafts for this editor",{exact:true}).click();await page.getByRole("button",{name:/Review kept draft/}).click();}
  if(state==="discard"){await page.locator(".prayer-record-editor").getByRole("button",{name:"Cancel editing",exact:true}).click();}
  if(state==="text200")await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
  if(state==="conflict"){await page.evaluate(async()=>{
   const database=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("my-daily-devotion");request.onsuccess=()=>resolve(request.result);});
   await new Promise<void>((resolve,reject)=>{const tx=database.transaction("prayers","readwrite"),store=tx.objectStore("prayers"),request=store.getAll();request.onsuccess=()=>{const item=request.result[0];store.put({...item,body:"The request saved in another tab.",revision:item.revision+1,updatedAt:"2026-04-24T05:01:00.000Z"});};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});database.close();window.dispatchEvent(new Event("focus"));
  });await page.getByRole("button",{name:"Compare versions",exact:true}).click();}
  await expectNoHorizontalOverflow(page);await expectNoAxeViolations(page);await settle(page);await expect(page).toHaveScreenshot("prayer-writing-"+state+".png",{fullPage:true});
 });
}
