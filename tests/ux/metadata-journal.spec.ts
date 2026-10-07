import { expect, test, type Page } from "@playwright/test";
import { seedMetadata, selectMetadata, editMetadata } from "./metadata-fixture";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";
import { writingSnapshot } from "./writing-fixture";
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });

test("directories, counts, search, expansion and pagination are readonly", async ({ page }) => {
  await seedMetadata(page, "people", { count: 45, prayers: 28 }); const before = await writingSnapshot(page);
  await expect(page.locator(".directory-row")).toHaveCount(20);
  await page.getByRole("button", { name: "Show more", exact: true }).click(); await expect(page.locator(".directory-row")).toHaveCount(40);
  await page.getByLabel("Search people").fill("Friend"); await expect(page.locator(".directory-row").first()).toContainText("Anna");
  await page.getByLabel("Search people").fill("faithful"); await expect(page.getByRole("heading", { name: "No matching people" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click(); await selectMetadata(page, "Anna Wilson");
  await expect(page.locator(".directory-prayers a")).toHaveCount(5);
  for (const status of ["Active", "Waiting", "Answered", "Archived"]) await expect(page.locator(".directory-prayers small").filter({ hasText: status }).first()).toBeVisible();
  await page.getByRole("button", { name: "Show more prayers" }).click(); await expect(page.locator(".directory-prayers a")).toHaveCount(15);
  await openRoute(page, "/prayer/people?entry=person-44");
  await expect(page.locator(".directory-pagination").last()).toContainText("Showing 20 of 45 people. Selected entry also shown.");
  await expect(page.locator(".directory-row")).toHaveCount(21);
  await expect(page.getByText("Selected entry · outside this page or search", { exact: true })).toBeVisible();
  expect(await writingSnapshot(page)).toEqual(before);
});
test("starter categories require explicit activation and are idempotent", async ({ page }) => {
  await openRoute(page, "/prayer/categories"); const before = await writingSnapshot(page);
  await expect(page.getByRole("button", { name: "Add suggested categories" })).toBeVisible(); expect(await writingSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Add suggested categories" }).dblclick(); await expect(page.locator(".directory-row")).toHaveCount(7);
  await page.reload(); await expect(page.locator(".directory-row")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Add suggested categories" })).toHaveCount(0);
});
test("explicit creation preserves people with equal names and reveals existing categories", async ({ page }) => {
  await seedMetadata(page);
  await page.getByRole("button", { name: "Add person", exact: true }).click(); await expect(page.getByLabel("Name", { exact: true })).not.toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Anna Wilson"); await page.getByRole("button", { name: "Save person", exact: true }).click();
  await expect(page.locator(".directory-row-copy strong").filter({ hasText: "Anna Wilson" })).toHaveCount(2);
  await openRoute(page, "/prayer/categories"); await page.getByRole("button", { name: "Add category", exact: true }).click(); await page.getByLabel("Name", { exact: true }).fill(" personal ");
  await page.getByRole("button", { name: "Save category", exact: true }).click(); await expect(page.locator(".journal-status")).toContainText("already exists");
  await expect(page.locator(".directory-row")).toHaveCount(5);
});
test("dirty switching offers save, discard and keep; cancel restores focus", async ({ page }) => {
  await seedMetadata(page); await editMetadata(page, "Anna Wilson"); await page.getByLabel("Notes", { exact: false }).fill("Keep this writing.");
  await page.getByRole("button", { name: "Add person", exact: true }).click(); await page.getByRole("button", { name: "Keep editing" }).click(); await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Keep this writing.");
  await page.getByRole("button", { name: "Add person", exact: true }).click(); await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(""); await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(page.locator("#metadata-add")).toBeFocused();
  await editMetadata(page, "Anna Wilson"); await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Keep this writing.");
  await page.getByLabel("Notes", { exact: false }).fill("Discard this."); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard and continue" }).click(); await expect(page.getByRole("button", { name: "Edit person", exact: true })).toBeFocused();
});
test("linked removals are blocked and unlinked removal uses an accessible confirmation", async ({ page }) => {
  await seedMetadata(page); await selectMetadata(page, "Anna Wilson"); await page.getByRole("button", { name: "Remove person", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Answered and Archived prayers retain their links");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Remove person", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); await selectMetadata(page, "Daniel Kim");
  await page.getByRole("button", { name: "Remove person", exact: true }).click(); await expect(page.getByRole("dialog")).toContainText("Existing backups are unaffected");
  await page.getByRole("dialog").getByRole("button", { name: "Remove person", exact: true }).click(); await expect(page.locator(".directory-row")).toHaveCount(4);
});
test("filtered origin and linked Detail Settings return restore the directory and focus", async ({ page }) => {
  await seedMetadata(page);
  const origin = "/prayer?status=WAITING&person=person-0&category=category-0";
  await openRoute(page, origin); await page.getByRole("link", { name: "People", exact: true }).click();
  await selectMetadata(page, "Anna Wilson"); await page.getByRole("button", { name: "Show more prayers" }).click();
  const url = page.url(); const link = page.locator(".directory-prayers a").first(); const id = await link.getAttribute("id");
  await link.click(); await expect(page.locator(".prayer-request-text")).toBeVisible();
  await page.getByRole("link", { name: "Edit details", exact: true }).click(); await expect(page.getByRole("heading", { name: "Prayer settings" })).toBeVisible();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page.locator(".journal-heading .quiet-back-link").click();
  await expect(page).toHaveURL(url); await expect(page.locator("#" + id)).toBeFocused(); await expect(page.locator(".directory-prayers a")).toHaveCount(8);
  await page.locator(".journal-heading .quiet-back-link").click(); expect(new URL(page.url()).hash).toBe("#" + origin);
});
test("conflict comparison preserves both versions and requires an explicit save", async ({ page, context }) => {
  await seedMetadata(page); await editMetadata(page, "Anna Wilson"); await page.getByLabel("Notes", { exact: false }).fill("My local writing.");
  const other = await context.newPage(); await openRoute(other, "/prayer/people"); await editMetadata(other, "Anna Wilson");
  await other.getByLabel("Notes", { exact: false }).fill("Saved in another tab."); await other.getByRole("button", { name: "Save changes" }).click(); await expect(other.locator(".directory-notes")).toContainText("Saved in another tab.");
  await page.getByRole("button", { name: "Save changes" }).click(); await page.getByRole("button", { name: "Compare versions" }).click();
  const before = await writingSnapshot(page); await expect(page.locator(".directory-versions")).toContainText("My local writing."); await expect(page.locator(".directory-versions")).toContainText("Saved in another tab.");
  await page.getByRole("button", { name: "Keep my changes for review" }).click(); expect(await writingSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Save changes" }).click(); await expect(page.locator(".directory-notes")).toContainText("My local writing.");
});
test("deleted entries preserve unsaved notes and cannot be recreated", async ({ page, context }) => {
  await seedMetadata(page); await editMetadata(page, "Daniel Kim"); await page.getByLabel("Notes", { exact: false }).fill("Keep this private writing.");
  const other = await context.newPage(); await openRoute(other, "/prayer/people"); await selectMetadata(other, "Daniel Kim"); await other.getByRole("button", { name: "Remove person", exact: true }).click(); await other.getByRole("dialog").getByRole("button", { name: "Remove person", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Your unsaved writing")).toHaveValue(/Keep this private writing/);
  await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
test("failed creation retains writing and retry creates exactly one record", async ({ page }) => {
  await openRoute(page, "/prayer/people"); await page.getByRole("button", { name: "Add person", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Anna"); await page.getByLabel("Notes", { exact: false }).fill("Retain these notes.");
  await page.evaluate(() => { const original = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function (...args) { if (this.name === "people") { IDBObjectStore.prototype.add = original; throw new DOMException("Storage full. Try again.", "QuotaExceededError"); } return original.apply(this, args); }; });
  await page.getByRole("button", { name: "Save person", exact: true }).click(); await expect(page.locator(".journal-status")).toContainText("Storage full");
  await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Retain these notes.");
  await page.getByRole("button", { name: "Save person", exact: true }).dblclick(); await expect(page.locator(".directory-row")).toHaveCount(1);
});
test("all widths, dark colors, keyboard targets and enlarged text remain usable", async ({ page }) => {
  await seedMetadata(page, "people", { long: true });
  for (const width of [320,360,390,430,768,1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoHorizontalOverflow(page); }
  await page.setViewportSize({ width: 390, height: 844 }); await expect(page.locator(".mobile-nav")).toBeVisible();
  for (const scheme of ["light", "dark"] as const) { await page.emulateMedia({ colorScheme: scheme }); await expectNoAxeViolations(page); }
  await page.getByRole("button", { name: "Add person", exact: true }).click(); await expectNoAxeViolations(page);
  const targets = await page.locator(".metadata-journal button:visible,.metadata-journal input:visible").evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height)); expect(Math.min(...targets)).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 320, height: 844 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
});

test("delayed editor focus does not interrupt writing already begun", async ({ page }) => {
  await seedMetadata(page, "categories");
  await page.evaluate(() => {
    const state = window as unknown as { releaseEditorFrames: () => void };
    const original = window.requestAnimationFrame;
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    state.releaseEditorFrames = () => {
      window.requestAnimationFrame = original;
      for (const callback of callbacks) callback(performance.now());
    };
  });
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("New");
  await page.evaluate(() => (window as unknown as { releaseEditorFrames: () => void }).releaseEditorFrames());
  await expect(name).toBeFocused();
  await page.keyboard.type(" category");
  await expect(name).toHaveValue("New category");
  await expect(page.getByRole("button", { name: "Save category", exact: true })).toBeEnabled();
});

test("committed creation survives failed refresh without repeating", async ({ page }) => {
  await openRoute(page, "/prayer/people"); await page.getByRole("button", {name:"Add person",exact:true}).click();
  await page.getByLabel("Name", {exact:true}).fill("Committed person");
  await page.evaluate(() => {
    const cursor=IDBObjectStore.prototype.openCursor, add=IDBObjectStore.prototype.add; let fail=false;
    IDBObjectStore.prototype.openCursor=function(...args){if(fail&&this.name==="people"&&this.transaction.mode==="readonly")throw new Error("Refresh unavailable");return cursor.apply(this,args);};
    IDBObjectStore.prototype.add=function(...args){if(this.name==="people")this.transaction.addEventListener("complete",()=>{fail=true;});return add.apply(this,args);};
    (window as any).restoreMetadataRead=()=>{IDBObjectStore.prototype.openCursor=cursor;IDBObjectStore.prototype.add=add;};
  });
  await page.getByRole("button",{name:"Save person",exact:true}).click();
  await expect(page.getByRole("button",{name:"Retry refresh",exact:true})).toBeVisible();
  await expect(page.locator(".directory-row-copy")).toContainText("Committed person");
  const committed=await writingSnapshot(page);
  // Foreground refresh may run while Playwright focuses WebKit for the click.
  // Keep reads failing until the actual Retry activation, then restore before
  // React handles it so this exercises explicit retry rather than racing it.
  await page.evaluate(()=>{const button=Array.from(document.querySelectorAll('button')).find(node=>node.textContent==='Retry refresh');if(!button)throw new Error('Expected failed refresh control');button.addEventListener('click',()=>(window as any).restoreMetadataRead(),{capture:true,once:true});});
  await page.getByRole("button",{name:"Retry refresh",exact:true}).click();await expect(page.getByRole("button",{name:"Retry refresh",exact:true})).toHaveCount(0);
  expect(await writingSnapshot(page)).toEqual(committed);await expect(page.locator(".directory-row")).toHaveCount(1);
});
test("late writing during commitment remains unsaved without duplicate creation", async ({page})=>{
  await openRoute(page,"/prayer/people");await page.getByRole("button",{name:"Add person",exact:true}).click();await page.getByLabel("Name",{exact:true}).fill("Late writer");await page.getByLabel("Notes",{exact:false}).fill("Submitted.");
  await holdMetadataWrites(page);
  await page.getByRole("button",{name:"Save person",exact:true}).click();await expect(page.getByLabel("Notes",{exact:false})).toBeDisabled();
  await page.getByLabel("Notes",{exact:false}).evaluate((input:HTMLTextAreaElement)=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(input,"Submitted. Newer writing.");input.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.evaluate(()=>{(window as any).releaseMetadataLock=true;});
  await expect(page.locator(".journal-status")).toContainText("Newer writing is still unsaved");await expect(page.getByLabel("Notes",{exact:false})).toHaveValue("Submitted. Newer writing.");
  await page.getByRole("button",{name:"Save changes",exact:true}).click();await expect(page.locator(".directory-notes")).toContainText("Newer writing");await expect(page.locator(".directory-row")).toHaveCount(1);
});
async function holdMetadataWrites(page:Page){
  await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("my-daily-devotion");r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction("people","readwrite");(window as any).releaseMetadataLock=false;const keep=()=>{const r=tx.objectStore("people").get("person-0");r.onsuccess=()=>{if(!(window as any).releaseMetadataLock)keep();};};keep();tx.oncomplete=()=>db.close();
  });
}
test("linked-request failures keep the directory and retry without writes",async({page})=>{
  await seedMetadata(page);const before=await writingSnapshot(page);
  await page.evaluate(()=>{const cursor=IDBIndex.prototype.openCursor;IDBIndex.prototype.openCursor=function(...args){if(this.objectStore.name==="prayers"&&this.name==="personId")throw new Error("Linked requests unavailable");return cursor.apply(this,args);};(window as any).restoreLinked=()=>{IDBIndex.prototype.openCursor=cursor;};});
  await selectMetadata(page,"Anna Wilson");await expect(page.locator(".directory-row")).toHaveCount(5);await expect(page.getByRole("button",{name:"Retry refresh",exact:true})).toBeVisible();
  await page.evaluate(()=>(window as any).restoreLinked());await page.getByRole("button",{name:"Retry refresh",exact:true}).click();await expect(page.locator(".directory-prayers a")).toHaveCount(5);expect(await writingSnapshot(page)).toEqual(before);
});
test("invalid parameters and unavailable selections recover without writes",async({page})=>{
  await seedMetadata(page);const before=await writingSnapshot(page);
  await openRoute(page,"/prayer/people?entry=..%2Fevil&shown=NaN&prayersShown=0&return=%2F%2Fevil");
  await expect(page).toHaveURL(/#\/prayer\/people$/);
  await openRoute(page,"/prayer/people?entry=missing");await expect(page.getByRole("button",{name:"Return to directory"})).toBeVisible();await page.getByRole("button",{name:"Return to directory"}).click();await expect(page.locator(".directory-row")).toHaveCount(5);
  expect(await writingSnapshot(page)).toEqual(before);
});
test("Browser Back restores search, pagination, selected request and exact focus",async({page})=>{
  await seedMetadata(page,"people",{count:45,prayers:8});await page.getByRole("button",{name:"Show more",exact:true}).click();await selectMetadata(page,"Anna Wilson");const origin=page.url();
  await page.locator(".directory-prayers a").first().click();await expect(page.locator(".prayer-request-text")).toBeVisible();await page.goBack();
  await expect(page).toHaveURL(origin);await expect(page.locator(".directory-prayers a").first()).toBeFocused();await expect(page.locator(".directory-row")).toHaveCount(40);
});
