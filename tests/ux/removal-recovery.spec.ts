import { test, expect } from "@playwright/test";
import { openRoute, expectNoAxeViolations } from "./helpers";
import { seedRemoval, removalSnapshot } from "./removal-fixture";
test("removed directory, paging, copy and cancellation are readonly",async({page})=>{
  await seedRemoval(page,25);const before=await removalSnapshot(page);await openRoute(page,"/recovery?view=removed&return=%2Fdata");
  await expect(page.locator(".recovery-pagination")).toContainText("20 of 25 removals");await expect(page.locator(".recovery-directory")).not.toContainText("Current writing");
  await page.getByRole("link",{name:"Show more",exact:true}).click();await expect(page.locator(".recovery-pagination")).toContainText("25 of 25 removals");
  await page.locator(".recovery-directory a").first().click();await page.getByRole("button",{name:"Select reflection to copy"}).click();
  await page.getByRole("button",{name:"Restore removed records",exact:true}).click();await expect(page.getByRole("button",{name:"Keep removed",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Restore removed records",exact:true})).toBeFocused();
  expect(await removalSnapshot(page)).toEqual(before);await expectNoAxeViolations(page);
});
test("explicit restoration preserves events, IDs and dates and cannot replay",async({page})=>{
  const id=await seedRemoval(page),before=await removalSnapshot(page);await openRoute(page,`/recovery/removed/${id}?return=%2Ftoday%2Freflection%2F2024-02-29`);
  await page.getByRole("button",{name:"Restore removed records",exact:true}).click();await page.getByRole("button",{name:"Restore records",exact:true}).click();
  await expect(page.getByText(/removed records were restored locally/)).toBeVisible();const after=await removalSnapshot(page);
  expect(after.activityEvents).toEqual(before.activityEvents);expect(after.reflections).toEqual([expect.objectContaining({id:(before.reflections[0] as {id:string}).id,revision:4,localDate:"2024-02-29",deletedAt:null,bodyMd:"Current writing.\n\nStill learning to notice."})]);
  await page.reload();await expect(page.getByText(/already restored/)).toBeVisible();await expect(page.getByRole("button",{name:"Restore removed records",exact:true})).toHaveCount(0);expect(await removalSnapshot(page)).toEqual(after);
  await page.getByRole("link",{name:"Back",exact:false}).first().click();await expect(page.getByRole("heading",{name:"Recently removed",exact:true})).toBeVisible();
});
test("changed tombstones block stale confirmation without losing the copy",async({page})=>{
  const id=await seedRemoval(page);await openRoute(page,`/recovery/removed/${id}`);await page.getByRole("button",{name:"Restore removed records",exact:true}).click();
  await page.evaluate(async()=>new Promise<void>(resolve=>{const open=indexedDB.open("my-daily-devotion");open.onsuccess=()=>{const db=open.result,tx=db.transaction("reflections","readwrite"),store=tx.objectStore("reflections"),read=store.getAll();read.onsuccess=()=>store.put({...read.result[0],revision:4});tx.oncomplete=()=>{db.close();resolve();};};}));
  const before=await removalSnapshot(page);await page.getByRole("button",{name:"Restore records",exact:true}).click();await expect(page.getByText(/removed entry changed after/)).toBeVisible();await expect(page.getByLabel("Reflection",{exact:true})).toHaveValue(/Current writing/);expect(await removalSnapshot(page)).toEqual(before);
});
test("failed restoration rolls back; failed refresh retains commitment without repeating it",async({page})=>{
  const id=await seedRemoval(page);await openRoute(page,`/recovery/removed/${id}`);await page.getByRole("button",{name:"Restore removed records",exact:true}).click();
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="reflections")throw new DOMException("Failed write","UnknownError");return put.apply(this,args);};});const before=await removalSnapshot(page);
  await page.getByRole("button",{name:"Restore records",exact:true}).click();await expect(page.getByText(/could not be restored/)).toBeVisible();expect(await removalSnapshot(page)).toEqual(before);
  await page.reload();await page.getByRole("button",{name:"Restore removed records",exact:true}).click();
  await page.evaluate(()=>{let restored=false;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="reflections")restored=true;return put.apply(this,args);};const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){if(restored&&this.name==="removalGroups")throw new DOMException("Failed refresh","UnknownError");return get.apply(this,args);};});
  await page.getByRole("button",{name:"Restore records",exact:true}).click();await expect(page.getByText(/removed records were restored locally/)).toBeVisible();await expect(page.getByRole("button",{name:"Retry refresh",exact:true})).toBeVisible();const committed=await removalSnapshot(page);
  await page.getByRole("button",{name:"Retry refresh",exact:true}).click();expect(await removalSnapshot(page)).toEqual(committed);await expect(page.getByText(/removed records were restored locally/)).toBeVisible();
});
test("expired and previous-journal removals stay copyable; invalid context and missing entries recover",async({page})=>{
  const id=await seedRemoval(page);await page.clock.setFixedTime(new Date(Date.now()+31*86400000));await openRoute(page,`/recovery/removed/${id}?shown=-1&return=https://outside.invalid`);
  await expect(page).toHaveURL(/shown=20/);await expect(page.getByText(/original thirty-day recovery window has ended/)).toBeVisible();await expect(page.getByRole("button",{name:"Restore removed records",exact:true})).toHaveCount(0);await expect(page.getByLabel("Reflection",{exact:true})).toHaveValue(/Current writing/);
  await openRoute(page,"/recovery/removed/missing");await expect(page.getByRole("heading",{name:"This removal is unavailable."})).toBeVisible();await expectNoAxeViolations(page);
});
