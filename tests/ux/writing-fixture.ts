import { expect, type Page } from "@playwright/test";
import { openRoute } from "./helpers";
export const writingBody = "### Grace for today\n\nHelp me listen with **patience** and respond with kindness.\n\n- Remember what I have received.\n- Make room for others.";
export const reflectionRoute = "/today/reflection/2026-04-24?return=%2Fhistory%3Fperiod%3Dthis-year%26shown%3D15";
export async function writingSnapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const request=indexedDB.open("my-daily-devotion");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error); });
    const names = Array.from(db.objectStoreNames).sort(); const tx=db.transaction(names,"readonly");
    const result=await Promise.all(names.map(name=>new Promise(resolve=>{const request=tx.objectStore(name).getAll();request.onsuccess=()=>resolve([name,request.result]);})));
    db.close();return result;
  });
}
export async function seedWriting(page: Page, screen: "reflection" | "prayer", long = false) {
  await openRoute(page, "/today");
  await page.evaluate(async ({ body }) => {
    const db=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("my-daily-devotion");request.onsuccess=()=>resolve(request.result);});
    const tx=db.transaction(["reflections","scriptureLinks"],"readwrite");
    const done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
    const base={createdAt:"2026-04-24T05:00:00.000Z",updatedAt:"2026-04-24T05:00:00.000Z",revision:1,deletedAt:null};
    tx.objectStore("reflections").put({...base,id:"writing-reflection",localDate:"2026-04-24",devotionDayId:"writing-day",bodyMd:body});
    tx.objectStore("scriptureLinks").put({...base,id:"writing-link",ownerType:"reflection",ownerId:"writing-reflection",translationId:"BSB",startVerseKey:"JHN.3.16",endVerseKey:"JHN.3.18"});
    await done;db.close();
  }, {body: long ? writingBody.repeat(18) : writingBody});
  await openRoute(page, screen==="reflection" ? reflectionRoute : "/prayer/new?sourceReflectionId=writing-reflection&sourceDevotionDate=2026-04-24&return="+encodeURIComponent(reflectionRoute));
  await expect(page.getByRole("heading",{name:screen==="reflection"?"Reflect":"Add prayer",exact:true})).toBeVisible();
  if(screen==="reflection")await expect(page.getByLabel("Daily reflection")).toHaveValue(long?writingBody.repeat(18):writingBody);
  else {await expect(page.locator(".journal-context")).toBeVisible();await page.getByLabel("What do you want to pray about?").fill("Give me patience and wisdom in the conversations ahead.");}
}
