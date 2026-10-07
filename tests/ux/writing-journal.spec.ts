import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";
import { reflectionRoute, seedWriting, writingBody, writingSnapshot, writingDomainSnapshot } from "./writing-fixture";

test("save-and-continue preserves Scripture, devotional date and complete return chain",async({page})=>{
  await seedWriting(page,"reflection");await page.getByLabel("Daily reflection").fill("Grace for the next conversation.");
  await page.getByRole("button",{name:"Save and continue to prayer"}).click();
  await expect(page.getByRole("heading",{name:"Add prayer"})).toBeVisible();
  await page.locator(".journal-context summary").click();await expect(page.locator(".journal-preview")).toContainText("Grace for the next conversation.");
  await expect(page.locator(".journal-scripture blockquote")).toContainText("For God so loved the world");
  await page.getByLabel("What do you want to pray about?").fill("Help me listen patiently.");
  await page.getByRole("button",{name:"Save prayer",exact:true}).click();await expect(page.locator(".prayer-request-text")).toHaveText("Help me listen patiently.");
  const data=await writingSnapshot(page);const prayers=data.find((row:any)=>row[0]==="prayers") as any;
  expect(prayers[1]).toHaveLength(1);expect(prayers[1][0]).toMatchObject({sourceReflectionId:"00000000-0000-4000-8000-000000000701",sourceDevotionDate:"2026-04-24"});
  const returnTarget=new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("return");expect(returnTarget).toBe(reflectionRoute);
  await page.goBack(); // the handoff remains in browser history
  await expect(page.getByRole("heading",{name:"Reflect",exact:true})).toBeVisible();
  await page.locator(".journal-heading .quiet-back-link").click();await expect(page).toHaveURL(/history\?period=this-year&shown=15/);
});
test("reading return restores the selected range",async({page})=>{
  await openRoute(page,"/bible/JHN/3?verse=16&endVerse=18");
  await expect(page.getByRole("button",{name:"Select John 3:18",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"More",exact:true}).click();await page.getByRole("button",{name:/Reflect/}).click();
  await page.locator(".journal-heading .quiet-back-link").click();await page.getByRole("button",{name:"Discard and continue"}).click();
  await expect(page.getByRole("button",{name:"Select John 3:18",exact:true})).toHaveAttribute("aria-pressed","true");
});
test("preview and prompts are safe; changed writing never writes domain records automatically",async({page})=>{
  await seedWriting(page,"reflection");const before=await writingDomainSnapshot(page);
  await page.getByLabel("Daily reflection").fill(writingBody+"\n<script>alert(1)</script>\n![remote](https://example.com/tracker.png)\n[unsafe](javascript:alert(1))");
  await page.getByRole("button",{name:"Preview",exact:true}).click();
  await expect(page.locator(".journal-preview strong")).toHaveText("patience");await expect(page.locator(".journal-preview img,.journal-preview script")).toHaveCount(0);
  await expect(page.locator('.journal-preview a[href^="javascript"]')).toHaveCount(0);
  await page.getByRole("button",{name:"Optional prompts",exact:true}).click();await page.getByRole("button",{name:"What stood out?",exact:true}).click();
  expect(await page.getByLabel("Daily reflection").inputValue()).toContain("### What stood out?");
  expect(await writingDomainSnapshot(page)).toEqual(before);
  await expect(page.locator(".draft-status")).toContainText("Draft kept on this device");
});
test("navigation dialog keeps, saves and discards deliberately",async({page})=>{
  await openRoute(page,"/today/reflection/2026-04-24");
  await page.getByLabel("Daily reflection").fill("Keep this writing.");
  await page.locator(".journal-heading .quiet-back-link").click();
  await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("button",{name:"Keep editing"})).toBeFocused();
  await page.getByRole("button",{name:"Keep editing"}).click();await expect(page.getByLabel("Daily reflection")).toHaveValue("Keep this writing.");
  await page.locator(".journal-heading .quiet-back-link").click();await page.getByRole("button",{name:"Save and continue",exact:true}).click();
  await expect(page).toHaveURL(/#\/today$/);await openRoute(page,"/today/reflection/2026-04-24");
  await expect(page.getByLabel("Daily reflection")).toHaveValue("Keep this writing.");
  await page.getByLabel("Daily reflection").fill("Discard this revision.");await page.locator(".journal-heading .quiet-back-link").click();await page.getByRole("button",{name:"Discard and continue"}).click();
  await expect(page).toHaveURL(/#\/today$/);
  await expect(page.getByRole("link",{name:/Reflect —/})).toBeVisible();
  await openRoute(page,"/today/reflection/2026-04-24");await expect(page.getByLabel("Daily reflection")).toHaveValue("Keep this writing.");
});
test("capture navigation dialog discards request and details without writes",async({page})=>{
  await openRoute(page,"/prayer/new");const before=await writingSnapshot(page);
  await page.getByLabel("What do you want to pray about?").fill("A temporary request.");
  await page.getByRole("button",{name:"Add details",exact:true}).click();await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("MANUAL_ONLY");
  await page.getByRole("link",{name:"Cancel",exact:true}).click();await page.getByRole("button",{name:"Keep editing"}).click();
  await expect(page.getByLabel("What do you want to pray about?")).toHaveValue("A temporary request.");
  await page.getByRole("link",{name:"Cancel",exact:true}).click();await page.getByRole("button",{name:"Discard and continue"}).click();
  await expect(page.locator(".grace-prayer")).toBeVisible();await openRoute(page,"/prayer/new");
  await expect(page.getByLabel("What do you want to pray about?")).toBeEmpty();await page.getByRole("button",{name:"Add details",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Schedule",exact:true})).toHaveValue("ROTATION");expect(await writingSnapshot(page)).toEqual(before);
});

test("conflicting or removed reflections retain unsaved writing",async({page,context})=>{
  await seedWriting(page,"reflection");await page.getByLabel("Daily reflection").fill("My unsaved version.");
  const other=await context.newPage();await openRoute(other,reflectionRoute);await other.getByLabel("Daily reflection").fill("Changed elsewhere.");await other.getByRole("button",{name:"Save reflection",exact:true}).click();await expect(other.locator(".journal-status")).toContainText("saved locally");
  await page.getByRole("button",{name:"Save reflection",exact:true}).click();
  await expect(page.getByRole("region",{name:"Edit conflict"})).toBeVisible();await expect(page.getByLabel("Your unsaved writing")).toHaveValue("My unsaved version.");await expect(page.getByLabel("Latest saved version")).toHaveValue("Changed elsewhere.");
  await page.getByRole("button",{name:"Keep my writing for the next save"}).click();await page.getByRole("button",{name:"Save reflection",exact:true}).click();
  await expect(page.locator(".journal-status")).toContainText("saved locally");
  await other.close();
});
test("capture keeps request and settings when collapsing details and crossing midnight",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-04-24T23:59:00+02:00"));
  await openRoute(page,"/prayer/new?translation=BSB&start=JHN.3.16&end=JHN.3.18&sourceDevotionDate=2026-04-24");
  await expect(page.getByLabel("What do you want to pray about?")).not.toBeFocused();
  await page.getByLabel("What do you want to pray about?").fill("A request begun yesterday.");
  await page.getByRole("button",{name:"Add details",exact:true}).click();await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("MANUAL_ONLY");
  await page.getByRole("button",{name:"Hide details",exact:true}).click();await page.clock.setFixedTime(new Date("2026-04-25T00:01:00+02:00"));
  await page.getByRole("button",{name:"Save prayer",exact:true}).click();await expect(page.locator(".prayer-request-text")).toHaveText("A request begun yesterday.");
  const data=await writingSnapshot(page);const prayers=data.find((row:any)=>row[0]==="prayers") as any;expect(prayers[1][0].sourceDevotionDate).toBe("2026-04-24");
  const schedules=data.find((row:any)=>row[0]==="prayerSchedules") as any;expect(schedules[1][0].mode).toBe("MANUAL_ONLY");
});
test("optional Scripture failure does not block capture and retry works",async({page})=>{
  await page.route("**/bible/books/JHN.json",route=>route.abort());
  await openRoute(page,"/prayer/new?translation=BSB&start=JHN.3.16&end=JHN.3.18");
  await page.locator(".journal-context summary").click();await expect(page.getByRole("button",{name:"Retry Scripture"})).toBeVisible();
  await page.getByLabel("What do you want to pray about?").fill("Still able to write.");
  await expect(page.getByRole("button",{name:"Save prayer",exact:true})).toBeEnabled();
  await page.unroute("**/bible/books/JHN.json");await page.getByRole("button",{name:"Retry Scripture"}).click();await expect(page.locator(".journal-scripture blockquote")).toContainText("For God so loved the world");
});
test("missing source requires an explicit choice and preserves the request",async({page})=>{
  await openRoute(page,"/prayer/new?sourceReflectionId=missing");
  await page.getByLabel("What do you want to pray about?").fill("Keep my request.");
  await expect(page.getByRole("button",{name:"Save prayer",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Continue without reflection"}).click();await page.getByRole("button",{name:"Save prayer",exact:true}).click();
  await expect(page.locator(".prayer-request-text")).toHaveText("Keep my request.");
});
test("failed reflection save retains writing and does not navigate",async({page})=>{
  await seedWriting(page,"reflection");await page.getByLabel("Daily reflection").fill("Keep this after failure.");
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==="reflections")throw new DOMException("Storage is unavailable.","QuotaExceededError");return original.apply(this,args);};});
  await page.getByRole("button",{name:"Save and continue to prayer"}).click();await expect(page.locator(".journal-status")).toContainText("Storage is unavailable");
  await expect(page.getByLabel("Daily reflection")).toHaveValue("Keep this after failure.");await expect(page).toHaveURL(/reflection/);
});
test("typing during save stays unsaved and prevents a handoff",async({page})=>{
  await seedWriting(page,"reflection");await page.getByLabel("Daily reflection").fill("The submitted version.");
  // Hold an IndexedDB transaction until the later typing is in the editor.
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("my-daily-devotion");r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction(["reflections"],"readwrite");(window as any).releaseWritingLock=false;
    const keep=()=>{const r=tx.objectStore("reflections").get("00000000-0000-4000-8000-000000000701");r.onsuccess=()=>{if(!(window as any).releaseWritingLock)keep();};};keep();tx.oncomplete=()=>db.close();
  });
  await page.getByRole("button",{name:"Save and continue to prayer"}).click();
  await expect(page.locator(".save-state")).toHaveText("Saving…");
  // Fields are protected during commitment; simulate input already queued by
  // the platform to retain the stronger newer-generation regression.
  await page.getByLabel("Daily reflection").evaluate((node: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, "The submitted version. Newer typing.");
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(()=>{(window as any).releaseWritingLock=true;});
  await expect(page.locator(".journal-status")).toContainText("latest changes are still unsaved");
  await expect(page.getByLabel("Daily reflection")).toHaveValue("The submitted version. Newer typing.");await expect(page.locator(".save-state")).toHaveText("Unsaved changes");
});
test("rapid capture submissions create only one prayer and History event",async({page})=>{
  await openRoute(page,"/prayer/new");await page.getByLabel("What do you want to pray about?").fill("A single request.");
  await page.getByRole("button",{name:"Save prayer",exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await expect(page.locator(".prayer-request-text")).toHaveText("A single request.");
  const data=await writingSnapshot(page);expect((data.find((row:any)=>row[0]==="prayers") as any)[1]).toHaveLength(1);
  expect((data.find((row:any)=>row[0]==="activityEvents") as any)[1].filter((event:any)=>event.type==="PRAYER_CREATED")).toHaveLength(1);
});
test("formatting preserves the selected words and keyboard save works",async({page})=>{
  await openRoute(page,"/today/reflection/2026-04-24");
  const editor=page.getByLabel("Daily reflection");await editor.fill("Remember grace today.");
  await editor.evaluate((node:HTMLTextAreaElement)=>{node.focus();node.setSelectionRange(9,14);node.dispatchEvent(new Event("select",{bubbles:true}));});
  await page.getByRole("button",{name:"Formatting",exact:true}).click();await page.getByRole("button",{name:"Bold",exact:true}).click();
  await expect(editor).toHaveValue("Remember **grace** today.");await expect(editor).toBeFocused();
  await editor.press("Control+s");await expect(page.locator(".journal-status")).toContainText("saved locally");
});
test("saving before opening Scripture returns to the newly saved prayer",async({page})=>{
  await seedWriting(page,"prayer");await page.locator(".journal-context summary").click();
  await page.locator(".journal-scripture a").click();await page.getByRole("button",{name:"Save and continue",exact:true}).click();
  await expect(page.getByRole("heading",{name:"John 3",level:2})).toBeVisible();
  const back=new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("return")!;
  expect(back).toMatch(/^\/prayer\/(?!new)[^?]+\?return=/);
  await page.getByRole("link",{name:"Return to devotional context",exact:true}).click();
  await expect(page.locator(".prayer-request-text")).toHaveText("Give me patience and wisdom in the conversations ahead.");
});
test("metadata failure leaves standalone capture usable",async({page})=>{
  await page.addInitScript(()=>{const original=IDBObjectStore.prototype.openCursor;IDBObjectStore.prototype.openCursor=function(...args){if(this.name==="people")throw new DOMException("People unavailable","UnknownError");return original.apply(this,args);};});
  await openRoute(page,"/prayer/new");await page.getByLabel("What do you want to pray about?").fill("A request without metadata.");
  await page.getByRole("button",{name:"Add details",exact:true}).click();await expect(page.getByRole("button",{name:"Retry details"})).toBeVisible();
  await page.getByRole("button",{name:"Save prayer",exact:true}).click();await expect(page.locator(".prayer-request-text")).toHaveText("A request without metadata.");
});
test("pending attachments are guarded and source disappearance never saves silently",async({page,context})=>{
  await openRoute(page,"/today/reflection/2026-04-24?translation=BSB&start=JHN.3.16&end=JHN.3.18");await page.locator(".journal-heading .quiet-back-link").click();
  await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("button",{name:"Save and continue",exact:true})).toBeDisabled();await page.getByRole("button",{name:"Discard and continue"}).click();
  await seedWriting(page,"prayer");
  const other=await context.newPage();await openRoute(other,"/today/reflection/2026-04-24");await other.getByRole("button",{name:"Remove reflection",exact:true}).click();await other.getByRole("dialog").getByRole("button",{name:"Remove reflection",exact:true}).click();await expect(other.locator(".journal-status")).toHaveText("Reflection removed.");
  await page.getByRole("button",{name:"Save prayer",exact:true}).click();await expect(page.getByRole("button",{name:"Retry source"})).toBeVisible();await expect(page.getByLabel("What do you want to pray about?")).toHaveValue("Give me patience and wisdom in the conversations ahead.");
  expect(( (await writingSnapshot(page)).find((row:any)=>row[0]==="prayers") as any)[1]).toHaveLength(0);await other.close();
});
test("opening capture and its details never creates metadata or events",async({page})=>{
  await openRoute(page,"/today");const before=await writingSnapshot(page);
  await openRoute(page,"/prayer/new");await page.getByRole("button",{name:"Add details",exact:true}).click();await expect(page.getByRole("combobox",{name:"Category optional"})).toBeVisible();
  expect(await writingSnapshot(page)).toEqual(before);
});
test("discarding a same-date route change restores saved writing",async({page})=>{
  await seedWriting(page,"reflection");
  await openRoute(page,"/today/reflection/2026-04-24?return="+encodeURIComponent("/today/reflection/2026-04-24?return=%2Ftoday"));
  await page.getByLabel("Daily reflection").fill("Discard this temporary version.");
  await page.locator(".journal-heading .quiet-back-link").click();
  await page.getByRole("button",{name:"Discard and continue"}).click();
  await expect(page.getByLabel("Daily reflection")).toHaveValue(writingBody);
  await expect(page.locator(".journal-heading .quiet-back-link")).toHaveAttribute("href","#/today");
});
test("detaching the incoming passage does not silently reattach it on save",async({page})=>{
  await seedWriting(page,"reflection");
  await openRoute(page,"/today/reflection/2026-04-24?translation=BSB&start=JHN.3.16&end=JHN.3.18");
  await page.locator(".journal-context summary").click();await page.getByRole("button",{name:"Detach JHN.3.16",exact:true}).click();
  await expect(page.locator(".journal-context")).toHaveCount(0);
  await page.getByLabel("Daily reflection").fill("Remember grace without a linked passage.");await page.getByRole("button",{name:"Save reflection",exact:true}).click();await expect(page.locator(".journal-status")).toContainText("saved locally");
  const links=((await writingSnapshot(page)).find((row:any)=>row[0]==="scriptureLinks") as any)[1];expect(links.filter((link:any)=>link.deletedAt===null)).toHaveLength(0);
});
test("both writing screens reflow and remain accessible in light and dark",async({page})=>{
  for(const screen of ["reflection","prayer"] as const){
    await seedWriting(page,screen);
    for(const width of [320,360,390,430,768,1440]){await page.setViewportSize({width,height:844});await expectNoHorizontalOverflow(page);await expect(page.locator(".journal-heading .grace-art img")).toBeVisible();}
    for(const colorScheme of ["light","dark"] as const){
      await page.emulateMedia({colorScheme});
      await expectNoAxeViolations(page);
    }
    await page.setViewportSize({width:320,height:568});await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});await expectNoHorizontalOverflow(page);
    const sizes=await page.locator(".journal-workspace button:visible,.journal-heading a:visible").evaluateAll(nodes=>nodes.map(node=>({w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})));
    for(const size of sizes){expect(size.w).toBeGreaterThanOrEqual(44);expect(size.h).toBeGreaterThanOrEqual(44);}
    await page.evaluate(()=>{document.documentElement.style.fontSize="";});
  }
});

test("acknowledged reflection drafts survive reload and recover only on explicit choice", async ({ page }) => {
  await seedWriting(page, "reflection"); const before = await writingDomainSnapshot(page);
  await page.getByLabel("Daily reflection").fill("A reflection interrupted before saving.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  expect(await writingDomainSnapshot(page)).toEqual(before);
  const initial = await writingSnapshot(page);
  expect((initial.find((row: any) => row[0] === "editorDrafts") as any)[1].filter((row: any) => row.state === "active")).toHaveLength(1);
  await page.reload(); await expect(page.getByLabel("Daily reflection")).toHaveValue(writingBody);
  await page.getByText("Kept drafts for this date", { exact: false }).click();
  await page.getByRole("button", { name: /Review draft kept/ }).click();
  await expect(page.getByLabel("Your kept draft")).toHaveValue("A reflection interrupted before saving.");
  expect(await writingDomainSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Recover for review" }).click();
  await expect(page.getByLabel("Daily reflection")).toHaveValue("A reflection interrupted before saving.");
  expect(await writingDomainSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.locator(".reflection-status")).toContainText("saved locally");
  const after = await writingSnapshot(page), drafts = (after.find((row: any) => row[0] === "editorDrafts") as any)[1];
  expect(drafts.filter((row: any) => row.state === "active")).toHaveLength(0);
  expect((after.find((row: any) => row[0] === "activityEvents") as any)[1]).toEqual((before.find((row: any) => row[0] === "activityEvents") as any)[1]);
});

test("pristine reflection preview and tools create no recovery or domain records", async ({ page }) => {
  await seedWriting(page, "reflection"); const before = await writingSnapshot(page);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Formatting", exact: true }).click();
  await page.getByRole("button", { name: "Optional prompts", exact: true }).click();
  expect(await writingSnapshot(page)).toEqual(before);
});

test("a failed private checkpoint remains retryable without preventing an explicit reflection save", async ({ page }) => {
  await openRoute(page, "/today/reflection/2026-04-24");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "editorDraftContents" && !(window as any).allowDraftWrites) throw new DOMException("Draft storage unavailable", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByLabel("Daily reflection").fill("Keep me despite the checkpoint failure.");
  await expect(page.getByRole("alert")).toContainText("Draft could not be kept");
  await expect(page.getByLabel("Daily reflection")).toHaveValue("Keep me despite the checkpoint failure.");
  // The atomic explicit save retires its submitted contents; no separate draft
  // body write is required when the first checkpoint never succeeded.
  await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.locator(".reflection-status")).toContainText("saved locally");
  const after = await writingSnapshot(page);
  expect((after.find((row: any) => row[0] === "reflections") as any)[1]).toHaveLength(1);
  expect((after.find((row: any) => row[0] === "activityEvents") as any)[1].filter((event: any) => event.type === "REFLECTION_CREATED")).toHaveLength(1);
});

test("reflection draft recovery preserves the full incoming range and original date across midnight", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-04-24T23:59:00+02:00"));
  await openRoute(page, "/today/reflection/2026-04-24?translation=BSB&start=JHN.3.16&end=JHN.3.18&return=%2Fbible%2FJHN%2F3%3Fverse%3D16%26endVerse%3D18");
  const pristine = await writingSnapshot(page);
  expect((pristine.find((row: any) => row[0] === "editorDrafts") as any)[1]).toHaveLength(0);
  await page.getByLabel("Daily reflection").fill("Writing begun before midnight.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.clock.setFixedTime(new Date("2026-04-25T00:01:00+02:00")); await page.reload();
  await page.getByText("Kept drafts for this date", { exact: false }).click(); await page.getByRole("button", { name: /Review draft kept/ }).click();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Recover for review" }).click();
  await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.locator(".reflection-status")).toContainText("saved locally");
  const saved = await writingSnapshot(page);
  expect((saved.find((row: any) => row[0] === "reflections") as any)[1][0]).toMatchObject({ localDate: "2026-04-24", bodyMd: "Writing begun before midnight." });
  expect((saved.find((row: any) => row[0] === "scriptureLinks") as any)[1][0]).toMatchObject({ translationId: "BSB", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.18" });
});

test("explicit reflection save uses the latest text after a later private checkpoint fails", async ({ page }) => {
  await openRoute(page, "/today/reflection/2026-04-24"); await page.getByLabel("Daily reflection").fill("Older kept text.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === "editorDraftContents") throw new DOMException("Checkpoint unavailable", "QuotaExceededError"); return original.apply(this, args); }; });
  await page.getByLabel("Daily reflection").fill("The latest explicitly saved reflection.");
  await expect(page.getByRole("alert")).toContainText("Draft could not be kept");
  await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.locator(".reflection-status")).toContainText("saved locally");
  const data = await writingSnapshot(page);
  expect((data.find((row: any) => row[0] === "reflections") as any)[1][0]).toMatchObject({ bodyMd: "The latest explicitly saved reflection." });
  expect((data.find((row: any) => row[0] === "activityEvents") as any)[1].filter((event: any) => event.type === "REFLECTION_CREATED")).toHaveLength(1);
  expect((data.find((row: any) => row[0] === "editorDraftContents") as any)[1]).toHaveLength(0);
});

test("a recovered reflection removed in another tab stays copyable without recreation", async ({ page, context }) => {
  await seedWriting(page, "reflection"); await page.getByLabel("Daily reflection").fill("Copy this even if the saved record is removed.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  const other = await context.newPage(); await openRoute(other, reflectionRoute);
  await other.getByRole("button", { name: "Remove reflection", exact: true }).click();
  await other.getByRole("dialog").getByRole("button", { name: "Remove reflection", exact: true }).click();
  await expect(other.locator(".reflection-status")).toHaveText("Reflection removed."); await other.close();
  await page.reload(); const before = await writingDomainSnapshot(page);
  await page.getByText("Kept drafts for this date", { exact: false }).click(); await page.getByRole("button", { name: /Review draft kept/ }).click();
  await page.getByRole("button", { name: "Recover for review" }).click();
  await expect(page.getByLabel("Daily reflection")).toHaveValue("Copy this even if the saved record is removed.");
  await expect(page.getByRole("button", { name: "Keep my writing for the next save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save reflection", exact: true })).toBeDisabled();
  expect(await writingDomainSnapshot(page)).toEqual(before);
});

test("recovering from a different entry route restores the draft's original return chain", async ({ page }) => {
  await seedWriting(page, "reflection"); await page.getByLabel("Daily reflection").fill("Remember my original History destination.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await openRoute(page, "/today/reflection/2026-04-24?return=%2Ftoday");
  await page.getByText("Kept drafts for this date", { exact: false }).click(); await page.getByRole("button", { name: /Review draft kept/ }).click();
  await page.getByRole("button", { name: "Recover for review" }).click();
  await expect(page.locator(".journal-heading .quiet-back-link")).toHaveAttribute("href", "#/history?period=this-year&shown=15");
  await page.getByRole("button", { name: "Save and continue to prayer" }).click();
  await expect(page.getByRole("heading", { name: "Add prayer", exact: true })).toBeVisible();
  const returned = new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("return")!;
  expect(new URLSearchParams(returned.split("?")[1]).get("return")).toBe("/history?period=this-year&shown=15");
});
