import { test, expect } from "@playwright/test";
import { openRoute, expectNoAxeViolations } from "./helpers";
import { seedVersionReview, versionSnapshot } from "./version-review-fixture";
test("versions paging, comparison, copy and cancellation never write journal records", async ({page})=>{
  await seedVersionReview(page,25); const before=await versionSnapshot(page);
  await openRoute(page,"/recovery?view=versions&return=%2Fdata"); await expect(page.locator(".recovery-pagination")).toHaveText(/20 of 25 versions/);
  await page.getByRole("link",{name:"Show more",exact:true}).click();await expect(page.locator(".recovery-pagination")).toHaveText("25 of 25 versions");
  await page.locator(".recovery-directory a").first().click();await expect(page.getByRole("heading",{name:"Selected saved version"})).toBeVisible();
  await page.getByRole("button",{name:"Select writing to copy"}).last().click();expect(await versionSnapshot(page)).toEqual(before);await expectNoAxeViolations(page);
});
test("restore confirms explicitly, preserves history, and returns to the reflection",async({page})=>{
  const id=await seedVersionReview(page),before=await versionSnapshot(page);
  await page.getByRole("link",{name:"Earlier saved versions"}).click();await page.locator(`#version-entry-${id}`).click();
  await page.getByRole("button",{name:"Restore this writing"}).click();await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button",{name:"Keep current writing"}).click();expect(await versionSnapshot(page)).toEqual(before);
  await page.getByRole("button",{name:"Restore this writing"}).click();await page.getByRole("button",{name:"Restore writing",exact:true}).click();
  await expect(page.getByText(/selected writing was restored locally/)).toBeVisible(); const after=await versionSnapshot(page);
  expect(after.activityEvents).toEqual(before.activityEvents);expect(after.reflections).toEqual([expect.objectContaining({bodyMd:"Earlier writing.\n\nGrace in ordinary days.",revision:3,localDate:"2024-02-29"})]);
  await page.getByRole("link",{name:"Return to entry"}).click();await expect(page.getByRole("textbox",{name:"Daily reflection"})).toHaveValue("Earlier writing.\n\nGrace in ordinary days.");
});
test("a concurrent edit prevents a stale restore and retains the reviewed writing",async({page})=>{
  const id=await seedVersionReview(page);await openRoute(page,`/recovery/versions/${id}?return=%2Fdata`);
  await page.getByRole("button",{name:"Restore this writing"}).click();
  await page.evaluate(async()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open("my-daily-devotion");request.onsuccess=()=>{const db=request.result,tx=db.transaction("reflections","readwrite"),store=tx.objectStore("reflections"),get=store.getAll();get.onsuccess=()=>store.put({...get.result[0],bodyMd:"Other tab writing",revision:3});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
  const before=await versionSnapshot(page);await page.getByRole("button",{name:"Restore writing",exact:true}).click();await expect(page.getByText(/saved entry changed while/)).toBeVisible();expect(await versionSnapshot(page)).toEqual(before);
});
test("invalid optional context is normalized without writing and empty versions are usable",async({page})=>{
  await openRoute(page,"/recovery?view=versions&shown=-1&target=bad&return=https://outside.invalid");await expect(page.getByRole("heading",{name:"No earlier writing here yet."})).toBeVisible();
  await expect(page).toHaveURL(/shown=20/);await expectNoAxeViolations(page);expect((await versionSnapshot(page)).savedVersions).toHaveLength(0);
});
test("verse versions return to the exact open note and retain the unsaved navigation guard",async({page})=>{
  const route="/bible/JHN/3?verse=16&endVerse=18&return=%2Fhistory%3Fshown%3D40";
  await openRoute(page,route);await page.getByRole("button",{name:"Add verse note",exact:true}).click();const editor=page.getByLabel("Verse note",{exact:true});
  await editor.fill("First note for this complete range.");await page.getByRole("button",{name:"Save note",exact:true}).click();await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  await editor.fill("Second saved note.");await page.getByRole("button",{name:"Save note",exact:true}).click();await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  await editor.fill("Unfinished note stays here.");await page.getByRole("link",{name:"Earlier saved versions"}).click();await page.getByRole("button",{name:"Keep editing",exact:true}).click();await expect(editor).toHaveValue("Unfinished note stays here.");
  await page.getByRole("link",{name:"Earlier saved versions"}).click();await page.getByRole("button",{name:"Discard and continue",exact:true}).click();await expect(page.getByRole("heading",{name:"Saved versions",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Back",exact:false}).first().click();await expect(page.getByLabel("Verse note",{exact:true})).toHaveValue("Second saved note.");
  const params=new URLSearchParams(new URL(page.url()).hash.split("?")[1]);expect(params.get("start")).toBe("JHN.3.16");expect(params.get("end")).toBe("JHN.3.18");expect(params.get("return")).toBe("/history?shown=40");
});
test("failed restore retains both versions; retrying a failed refresh never restores twice",async({page})=>{
  const id=await seedVersionReview(page);await openRoute(page,`/recovery/versions/${id}?return=%2Fdata`);await page.getByRole("button",{name:"Restore this writing"}).click();
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="reflections")throw new DOMException("Write failed","UnknownError");return original.apply(this,args);};});
  const before=await versionSnapshot(page);await page.getByRole("button",{name:"Restore writing",exact:true}).click();await expect(page.getByText(/could not be restored/)).toBeVisible();expect(await versionSnapshot(page)).toEqual(before);
  await page.reload();await page.getByRole("button",{name:"Restore this writing"}).click();
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let restored=false;IDBObjectStore.prototype.put=function(...args){if(this.name==="reflections")restored=true;return original.apply(this,args);};const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){if(restored&&this.name==="savedVersions")throw new DOMException("Refresh failed","UnknownError");return get.apply(this,args);};});
  await page.getByRole("button",{name:"Restore writing",exact:true}).click();await expect(page.getByText(/selected writing was restored locally/)).toBeVisible();await expect(page.getByRole("button",{name:"Retry refresh",exact:true})).toBeVisible();
  const committed=await versionSnapshot(page);await page.getByRole("button",{name:"Retry refresh",exact:true}).click();await expect(page.getByText(/selected writing was restored locally/)).toBeVisible();expect(await versionSnapshot(page)).toEqual(committed);expect(committed.reflections).toEqual([expect.objectContaining({revision:3})]);
});
