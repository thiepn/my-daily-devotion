import {expect,test,type Locator} from "@playwright/test";
import {seedPrayerDetail,detailRoute} from "./prayer-detail-fixture";
import {writingSnapshot} from "./writing-fixture";
import {expectNoAxeViolations,expectNoHorizontalOverflow,openRoute} from "./helpers";
const editor=(page:any)=>page.locator(".prayer-record-editor");
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
test("detail browsing, selected timeline pagination and settings write no records",async({page})=>{
 await seedPrayerDetail(page,{count:45,long:true});await expect(page.locator(".prayer-request")).toBeVisible();
 const before=await writingSnapshot(page);
 await expect(page.getByLabel("Request",{exact:true})).toHaveCount(0);
 await expect(page.locator(".prayer-story-entry")).toHaveCount(20);
 await page.getByRole("button",{name:"Show more",exact:true}).click();await expect(page.locator(".prayer-story-entry")).toHaveCount(40);
 await openRoute(page,detailRoute+"&entry=update%3Adetail-update-0");
 await expect(page.locator('[id="prayer-entry-update:detail-update-0"]')).toBeFocused();
 await expect(page.locator(".prayer-story-entry")).toHaveCount(45);
 await expect(page.locator('[id="prayer-entry-update:detail-update-0"] button')).toHaveAttribute("aria-expanded","true");
 await page.getByRole("link",{name:"Edit details",exact:true}).click();
 await expect(page.getByRole("button",{name:"Save details",exact:true})).toBeDisabled();
 expect(await writingSnapshot(page)).toEqual(before);
});
test("wording and updates require explicit saves and switching resolves the current editor",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Edit wording",exact:true}).click();
 await page.getByLabel("Request",{exact:true}).fill("Revised request.");
 await page.locator(".prayer-record-actions").getByRole("button",{name:"Add update",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Save and continue"}).click();
 await expect(page.locator(".prayer-request-text")).toHaveText("Revised request.");
 await page.getByLabel("Prayer update").fill("A new encouragement.");
 await editor(page).getByRole("button",{name:"Encouragement",exact:true}).click();
 await editor(page).getByRole("button",{name:"Add encouragement",exact:true}).click();
 await expect(page.locator(".prayer-story-entry").first()).toContainText("A new encouragement.");
 const data=await writingSnapshot(page);expect((data.find((r:any)=>r[0]==="activityEvents") as any)[1].filter((e:any)=>e.type==="ENCOURAGEMENT_RECORDED")).toHaveLength(1);
});
test("answer drafts never mark answered through navigation and discarded text clears immediately",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Mark answered",exact:true}).click();
 await page.getByLabel("What happened?",{exact:false}).fill("Not ready to record.");
 await page.locator(".journal-heading .quiet-back-link").click();
 await expect(page.getByRole("dialog").getByRole("button",{name:"Save and continue"})).toHaveCount(0);
 await page.getByRole("button",{name:"Keep editing",exact:true}).click();await expect(page.getByLabel("What happened?",{exact:false})).toHaveValue("Not ready to record.");
 await editor(page).getByRole("button",{name:"Cancel editing"}).click();await page.getByRole("dialog").getByRole("button",{name:"Discard and continue"}).click();
 await page.getByRole("button",{name:"Mark answered",exact:true}).click();await expect(page.getByLabel("What happened?",{exact:false})).toHaveValue("");
 await editor(page).getByRole("button",{name:"Mark answered",exact:true}).click();
 await expect(page.locator(".journal-date")).toHaveText("answered");await expect(page.locator(".prayer-story-entry").first()).toContainText("No answer note was added.");
});
test("saving an update before archive uses its committed revision exactly once",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Add update",exact:true}).click();await page.getByLabel("Prayer update").fill("Keep this update.");
 await page.getByText("More actions",{exact:true}).click();await page.getByRole("button",{name:"Archive prayer"}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Save and continue"}).click();
 await expect(page.locator(".journal-date")).toHaveText("archived");await expect(page.locator(".prayer-story-entry").first()).toContainText("Keep this update.");
 await page.getByRole("button",{name:"Restore to active",exact:true}).click();await expect(page.locator(".journal-date")).toHaveText("active");
});
test("Scripture and source links retain exact ranges and complete return context",async({page})=>{
 await seedPrayerDetail(page);await page.locator("summary").filter({hasText:"Linked Scripture"}).click();
 const link=page.locator(".journal-scripture a");await expect(link).toHaveText("Colossians 4:2–3");
 await link.click();const params=new URLSearchParams(new URL(page.url()).hash.split("?")[1]);expect(params.get("start")).toBe("COL.4.2");expect(params.get("end")).toBe("COL.4.3");expect(params.get("return")).toBe(detailRoute);
 await page.goBack();await page.locator("summary").filter({hasText:"From your reflection"}).click();await page.getByRole("link",{name:"Open reflection",exact:true}).click();
 await expect(page.getByLabel("Daily reflection")).toBeVisible();expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("return")).toBe(detailRoute);
 await page.locator(".journal-heading .quiet-back-link").click();await expect(page.locator(".prayer-request")).toBeVisible();
});
test("optional Scripture failure keeps request usable and can retry",async({page})=>{
 await page.route("**/bible/books/COL.json",route=>route.abort());await seedPrayerDetail(page);
 await page.locator("summary").filter({hasText:"Linked Scripture"}).click();await expect(page.getByRole("button",{name:"Retry Scripture"})).toBeVisible();
 await page.getByRole("button",{name:"Prayed now",exact:true}).click();await expect(page.locator(".journal-status")).toContainText("Prayed now recorded");
 await page.unroute("**/bible/books/COL.json");await page.getByRole("button",{name:"Retry Scripture"}).click();await expect(page.locator(".journal-scripture blockquote")).toContainText("Devote yourselves to prayer");
});
test("settings retain hidden inputs, dirty navigation and the originating return URL",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();
 await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("INTERVAL_DAYS");await page.getByLabel("Every",{exact:true}).fill("9");
 await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("DAILY");await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("INTERVAL_DAYS");
 await expect(page.getByLabel("Every",{exact:true})).toHaveValue("9");await page.getByRole("link",{name:"Manage people",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Keep editing"}).click();await expect(page.getByLabel("Every",{exact:true})).toHaveValue("9");
 await page.getByRole("button",{name:"Save details",exact:true}).click();await expect(page.locator(".prayer-request")).toBeVisible();
 expect(new URL(page.url()).hash).toBe("#"+detailRoute);await expect(page.locator(".prayer-record-settings")).toContainText("9");
});
test("cross-tab wording conflicts preserve both versions and require explicit review",async({page,context})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Edit wording",exact:true}).click();await page.getByLabel("Request",{exact:true}).fill("My local wording.");
 const other=await context.newPage();await openRoute(other,detailRoute);await other.getByRole("button",{name:"Edit wording",exact:true}).click();await other.getByLabel("Request",{exact:true}).fill("Saved in another tab.");
 await other.getByRole("button",{name:"Save wording",exact:true}).click();await expect(other.locator(".prayer-request-text")).toHaveText("Saved in another tab.");
 await page.getByRole("button",{name:"Save wording",exact:true}).click();await page.getByRole("button",{name:"Compare versions",exact:true}).click();
 await expect(page.getByLabel("Your changes",{exact:true})).toHaveValue("My local wording.");await expect(page.getByLabel("Saved version",{exact:true})).toHaveValue("Saved in another tab.");
 await page.getByRole("button",{name:"Keep my wording for review"}).click();await page.getByRole("button",{name:"Save wording",exact:true}).click();await expect(page.locator(".prayer-request-text")).toHaveText("My local wording.");
});
test("settings conflicts use labeled fields and preserve unsaved values",async({page,context})=>{
 await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();const settings=page.url();
 await page.getByLabel("Focus until",{exact:false}).fill("2026-05-01");
 const other=await context.newPage();await other.goto(settings);await other.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("DAILY");await other.getByRole("button",{name:"Save details",exact:true}).click();await expect(other.locator(".prayer-request")).toBeVisible();
 await page.getByRole("button",{name:"Save details",exact:true}).click();await page.getByRole("button",{name:"Compare versions",exact:true}).click();
 await expect(page.locator(".prayer-settings-version").first()).toContainText("2026-05-01");await expect(page.locator(".prayer-settings-version").last()).toContainText("Daily");
 await page.getByRole("button",{name:"Use saved details",exact:true}).click();await expect(page.getByRole("combobox",{name:"Schedule",exact:true})).toHaveValue("DAILY");
});
test("failed saves keep writing and rapid submissions create one update",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Add update",exact:true}).click();await page.getByLabel("Prayer update").fill("Only one update.");
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.add;let fail=true;IDBObjectStore.prototype.add=function(...args){if(this.name==="prayerUpdates"&&fail){fail=false;throw new DOMException("Storage temporarily unavailable","QuotaExceededError");}return original.apply(this,args);};});
 await editor(page).getByRole("button",{name:"Add update",exact:true}).click();await expect(page.getByLabel("Prayer update")).toHaveValue("Only one update.");await expect(page.locator(".journal-status")).toContainText("Storage temporarily unavailable");
 await editor(page).getByRole("button",{name:"Add update",exact:true}).evaluate((button:HTMLButtonElement)=>{button.click();button.click();});
 await expect(page.locator(".prayer-story-entry").first()).toContainText("Only one update.");
 const data=await writingSnapshot(page);expect((data.find((r:any)=>r[0]==="prayerUpdates") as any)[1].filter((u:any)=>u.body==="Only one update.")).toHaveLength(1);
});
test("removing a prayer requires confirmation and returns to its exact origin",async({page})=>{
 await seedPrayerDetail(page);await page.getByText("More actions",{exact:true}).click();await page.getByRole("button",{name:"Remove prayer",exact:true}).click();
 await expect(page.getByRole("dialog")).toContainText("Existing backups are unaffected");await expect(page.getByRole("button",{name:"Keep prayer",exact:true})).toBeFocused();
 await page.getByRole("dialog").getByRole("button",{name:"Remove prayer",exact:true}).click();await expect(page.getByRole("heading",{name:"Prayer",exact:true})).toBeVisible();
 const data=await writingSnapshot(page);expect((data.find((r:any)=>r[0]==="prayers") as any)[1][0].deletedAt).not.toBeNull();
});
async function expectHoverContrast(button:Locator){
 await button.hover();
 const contrast=await button.evaluate(node=>{
  for(const animation of node.getAnimations()){const end=animation.effect?.getComputedTiming().endTime;if(typeof end==="number"&&Number.isFinite(end))animation.currentTime=end;}
  const style=getComputedStyle(node);
  const luminance=(color:string)=>{const channels=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];};
  const foreground=luminance(style.color),background=luminance(style.backgroundColor);
  return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
 });
 expect(contrast,"Hovered prayer action text contrast").toBeGreaterThanOrEqual(4.5);
}

test("journal controls support narrow, enlarged and dark keyboard use",async({page})=>{
 await page.setViewportSize({width:320,height:720});await seedPrayerDetail(page);
 await expectNoHorizontalOverflow(page);await expectNoAxeViolations(page);
 await page.getByText("More actions",{exact:true}).click();
 for(const theme of ["light","dark"]){
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  for(const name of ["Add update","Mark answered","Remove prayer"])await expectHoverContrast(page.getByRole("button",{name,exact:true}));
  await page.getByRole("button",{name:"Remove prayer",exact:true}).click();
  await expectHoverContrast(page.getByRole("dialog").getByRole("button",{name:"Remove prayer",exact:true}));
  await page.getByRole("button",{name:"Keep prayer",exact:true}).click();
 }
 await page.evaluate(()=>{delete document.documentElement.dataset.theme;});await page.mouse.move(0,0);
 await page.getByRole("button",{name:"Edit wording",exact:true}).click();await expect(page.getByLabel("Request",{exact:true})).toBeFocused();await expectNoAxeViolations(page);
 await page.getByRole("button",{name:"Cancel editing",exact:true}).click();await page.getByRole("link",{name:"Edit details",exact:true}).click();
 await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});await expectNoHorizontalOverflow(page);await expectNoAxeViolations(page);
 await page.emulateMedia({colorScheme:"dark"});await expectNoAxeViolations(page);
});

async function holdPrayerWrites(page:any){
 await page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("my-daily-devotion");r.onsuccess=()=>resolve(r.result);});
  const tx=database.transaction(["prayers"],"readwrite");(window as any).releasePrayerLock=false;
  const keep=()=>{const r=tx.objectStore("prayers").get("detail-fixture");r.onsuccess=()=>{if(!(window as any).releasePrayerLock)keep();};};keep();tx.oncomplete=()=>database.close();
 });
}
test("typing while wording saves retains newer changes without navigating",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Edit wording",exact:true}).click();await page.getByLabel("Request",{exact:true}).fill("Submitted wording.");
 await holdPrayerWrites(page);await page.getByRole("button",{name:"Save wording",exact:true}).click();await expect(page.locator(".save-state")).toHaveText("Saving…");
 await page.getByLabel("Request",{exact:true}).fill("Submitted wording. Newer typing.");await page.evaluate(()=>{(window as any).releasePrayerLock=true;});
 await expect(page.locator(".journal-status")).toContainText("Newer changes are still unsaved");await expect(page.getByLabel("Request",{exact:true})).toHaveValue("Submitted wording. Newer typing.");
 await expect(page.locator(".save-state")).toHaveText("Unsaved changes");await page.getByRole("button",{name:"Save wording",exact:true}).click();await expect(page.locator(".prayer-request-text")).toHaveText("Submitted wording. Newer typing.");
});
test("settings changed during save stay unsaved on the same route",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("DAILY");
 await holdPrayerWrites(page);await page.getByRole("button",{name:"Save details",exact:true}).click();await expect(page.getByRole("button",{name:"Saving…",exact:true})).toBeVisible();
 await page.getByLabel("Focus until",{exact:false}).fill("2026-05-03");await page.evaluate(()=>{(window as any).releasePrayerLock=true;});
 await expect(page.locator(".journal-status")).toContainText("Newer changes are still unsaved");await expect(page.getByLabel("Focus until",{exact:false})).toHaveValue("2026-05-03");
 await page.getByRole("button",{name:"Save details",exact:true}).click();await expect(page.locator(".prayer-record-settings")).toContainText("2026-05-03");
});
test("required load errors retry without modifying saved records",async({page})=>{
 await seedPrayerDetail(page);const before=await writingSnapshot(page);
 await page.addInitScript(()=>{const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){if(this.name==="prayers")throw new Error("Temporary read failure");return get.apply(this,args);};(window as any).restorePrayerRead=()=>{IDBObjectStore.prototype.get=get;};});
 await page.reload();await expect(page.getByRole("button",{name:"Retry",exact:true})).toBeVisible();await page.evaluate(()=>{(window as any).restorePrayerRead();});await page.getByRole("button",{name:"Retry",exact:true}).click();
 await expect(page.locator(".prayer-request")).toBeVisible();expect(await writingSnapshot(page)).toEqual(before);
});
test("missing metadata retains selection IDs and does not block schedule editing",async({page})=>{
 await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();
 await page.addInitScript(()=>{const cursor=IDBObjectStore.prototype.openCursor;IDBObjectStore.prototype.openCursor=function(...args){if(this.name==="categories")throw new Error("Metadata unavailable");return cursor.apply(this,args);};(window as any).restoreCategoryRead=()=>{IDBObjectStore.prototype.openCursor=cursor;};});
 await page.reload();await expect(page.getByRole("button",{name:"Retry people and categories"})).toBeVisible();await expect(page.getByLabel("Category optional")).toHaveValue("detail-category");await expect(page.getByLabel("Category optional")).toBeDisabled();
 await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("DAILY");await page.evaluate(()=>{(window as any).restoreCategoryRead();});await page.getByRole("button",{name:"Retry people and categories"}).click();await expect(page.getByLabel("Category optional")).toBeEnabled();await expect(page.getByLabel("Category optional")).toHaveValue("detail-category");
});
test("deletion in another tab keeps unsaved wording available without recreating the record",async({page,context})=>{
 await seedPrayerDetail(page);await page.getByRole("button",{name:"Edit wording",exact:true}).click();await page.getByLabel("Request",{exact:true}).fill("Keep this unsaved version.");
 const other=await context.newPage();await openRoute(other,detailRoute);await other.getByText("More actions",{exact:true}).click();await other.getByRole("button",{name:"Remove prayer",exact:true}).click();await other.getByRole("dialog").getByRole("button",{name:"Remove prayer",exact:true}).click();
 await expect(page.getByLabel("Unsaved prayer writing")).toHaveValue("Keep this unsaved version.");
 const snapshot=await writingSnapshot(page);expect((snapshot.find((r:any)=>r[0]==="prayers") as any)[1]).toHaveLength(1);expect((snapshot.find((r:any)=>r[0]==="prayers") as any)[1][0].deletedAt).not.toBeNull();
});

for(const action of ["update","answer","prayed"] as const)test("committed "+action+" survives a failed refresh without repeating the action",async({page})=>{
 await seedPrayerDetail(page);const before=await writingSnapshot(page);
 await page.evaluate(({action})=>{
  const originalGet=IDBObjectStore.prototype.get,originalAdd=IDBObjectStore.prototype.add,originalPut=IDBObjectStore.prototype.put;
  let fail=false;
  IDBObjectStore.prototype.get=function(...args){if(fail&&this.name==="prayers"&&this.transaction.mode==="readonly")throw new Error("Refresh temporarily unavailable");return originalGet.apply(this,args);};
  const arm=(store:IDBObjectStore)=>{if(store.name===(action==="update"?"prayerUpdates":action==="answer"?"prayerResolutions":"prayers"))store.transaction.addEventListener("complete",()=>{fail=true;});};
  IDBObjectStore.prototype.add=function(...args){arm(this);return originalAdd.apply(this,args);};
  IDBObjectStore.prototype.put=function(...args){arm(this);return originalPut.apply(this,args);};
  (window as any).restoreRead=()=>{fail=false;IDBObjectStore.prototype.get=originalGet;IDBObjectStore.prototype.add=originalAdd;IDBObjectStore.prototype.put=originalPut;};
 },{action});
 if(action==="update"){await page.getByRole("button",{name:"Add update",exact:true}).click();await page.getByLabel("Prayer update").fill("Saved once despite refresh failure.");await editor(page).getByRole("button",{name:"Add update",exact:true}).click();}
 if(action==="answer"){await page.getByRole("button",{name:"Mark answered",exact:true}).click();await editor(page).getByRole("button",{name:"Mark answered",exact:true}).click();}
 if(action==="prayed")await page.getByRole("button",{name:"Prayed now",exact:true}).click();
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 await expect(page.getByRole("button",{name:"Retry details",exact:true})).toBeVisible();await expect(page.locator(".prayer-request")).toBeVisible();
 if(action==="answer")await expect(page.locator(".journal-date")).toHaveText("answered");
 if(action==="update")await expect(page.locator(".prayer-story-entry").first()).toContainText("Saved once despite refresh failure.");
 await page.evaluate(()=>{(window as any).restoreRead();});await page.getByRole("button",{name:"Retry details",exact:true}).click();await expect(page.getByRole("button",{name:"Retry details",exact:true})).toHaveCount(0);
 const after=await writingSnapshot(page),table=(rows:any,name:string)=>rows.find((r:any)=>r[0]===name)[1];
 expect(table(after,"activityEvents").length-table(before,"activityEvents").length).toBe(1);expect(table(after,"prayers")[0].revision).toBe(2);
});
test("missing source writing stays private and settings never seed categories",async({page})=>{
 await seedPrayerDetail(page);
 await page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("my-daily-devotion");r.onsuccess=()=>resolve(r.result);});const tx=database.transaction(["reflections","categories"],"readwrite");tx.objectStore("reflections").delete("detail-reflection");tx.objectStore("categories").clear();await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});database.close();});
 await page.reload();await page.locator("summary").filter({hasText:"From your reflection"}).click();await expect(page.getByText("The original reflection is no longer available.")).toBeVisible();await expect(page.getByRole("link",{name:"Open reflection",exact:true})).toHaveCount(0);
 const before=await writingSnapshot(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();await expect(page.getByLabel("Category optional")).toHaveValue("detail-category");expect(await writingSnapshot(page)).toEqual(before);
});
test("settings and metadata management preserve selected entry and return focus",async({page})=>{
 await seedPrayerDetail(page,{count:45});const route=detailRoute+"&shown=40&entry=update%3Adetail-update-10";await openRoute(page,route);
 await expect(page.locator('[id="prayer-entry-update:detail-update-10"]')).toBeFocused();await page.getByRole("link",{name:"Edit details",exact:true}).click();const settingsHash=new URL(page.url()).hash;
 await page.getByRole("link",{name:"Manage people",exact:true}).click();await page.getByRole("button",{name:"Back",exact:true}).or(page.locator(".quiet-back-link")).visible().click();expect(new URL(page.url()).hash).toBe(settingsHash);
 await page.getByRole("link",{name:"Cancel",exact:true}).click();await expect(page.locator("#prayer-settings-link")).toBeFocused();expect(new URL(page.url()).hash).toBe("#"+route);await expect(page.locator(".prayer-story-entry")).toHaveCount(40);
});
test("late loads from an earlier prayer cannot replace the newly selected request",async({page,context})=>{
 await seedPrayerDetail(page);
 await page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("my-daily-devotion");r.onsuccess=()=>resolve(r.result);});const tx=database.transaction(["prayers"],"readwrite");const request=tx.objectStore("prayers").get("detail-fixture");request.onsuccess=()=>tx.objectStore("prayers").put({...request.result,id:"second-fixture",body:"The newly selected request."});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve();});database.close();});
 await openRoute(page,"/today");const other=await context.newPage();await openRoute(other,"/today");await holdPrayerWrites(other);
 // Exercise a pending route read, without restarting the app while its DB is locked.
 await page.evaluate(route=>{location.hash=route;},detailRoute);await expect(page.getByText("Opening prayer…",{exact:true})).toBeVisible();
 await page.evaluate(()=>{location.hash="/prayer/second-fixture?return=%2Fprayer";});await other.evaluate(()=>{(window as any).releasePrayerLock=true;});
 await expect(page.locator(".prayer-request-text")).toHaveText("The newly selected request.");await expect(page.locator(".prayer-request-text")).not.toContainText("Help Anna");
});
