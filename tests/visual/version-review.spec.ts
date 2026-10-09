import { test, expect } from "@playwright/test";
import { seedVersionReview } from "../ux/version-review-fixture";
import { openRoute, expectNoHorizontalOverflow } from "../ux/helpers";
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) {
  test(`Saved version comparison ${width}`,async({page})=>{
    await page.setViewportSize({width,height});const id=await seedVersionReview(page);await openRoute(page,`/recovery/versions/${id}?return=%2Fdata`);
    await expect(page.getByLabel("Writing",{exact:true}).last()).toHaveValue(/Earlier writing/);await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(`saved-version-comparison-${width}.png`,{fullPage:true});
  });
}
for(const state of ["directory","dark","enlarged","empty","dialog","removed","error"]) {
  test(`Saved versions ${state}`,async({page})=>{
    await page.setViewportSize({width:state==="enlarged"?320:390,height:844});if(state==="dark")await page.emulateMedia({colorScheme:"dark"});
    if(state==="empty"){await openRoute(page,"/recovery?view=versions");await expect(page.getByRole("heading",{name:"No earlier writing here yet."})).toBeVisible();}
    else {const id=await seedVersionReview(page,state==="directory"?25:1);await openRoute(page,state==="directory"?"/recovery?view=versions":`/recovery/versions/${id}?return=%2Fdata`);
      if(state==="directory")await expect(page.locator(".recovery-pagination")).toContainText("20 of 25 versions");else await expect(page.getByLabel("Writing",{exact:true}).last()).toBeVisible();
      if(state==="enlarged")await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
      if(state==="dialog"){await page.getByRole("button",{name:"Restore this writing"}).click();await expect(page.getByRole("dialog")).toBeVisible();}
      if(state==="removed") {await page.evaluate(async()=>new Promise<void>(resolve=>{const open=indexedDB.open("my-daily-devotion");open.onsuccess=()=>{const db=open.result,tx=db.transaction("reflections","readwrite"),store=tx.objectStore("reflections"),get=store.getAll();get.onsuccess=()=>store.put({...get.result[0],deletedAt:"2026-04-24T05:00:00.000Z"});tx.oncomplete=()=>{db.close();resolve();};};}));await page.reload();await expect(page.getByText(/original entry was removed/)).toBeVisible();}
      if(state==="error") {await page.evaluate(()=>{const original=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){if(this.name==="savedVersions")throw new DOMException("Unavailable","UnknownError");return original.apply(this,args);};});await page.getByRole("link",{name:"Back",exact:false}).first().click();await page.locator(".recovery-directory a").first().click();await expect(page.getByRole("button",{name:"Retry refresh"})).toBeVisible();}
    }
    await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await expectNoHorizontalOverflow(page);await expect(page).toHaveScreenshot(`saved-version-${state}.png`,{fullPage:true});
  });
}
