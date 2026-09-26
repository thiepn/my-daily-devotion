import { expect,test } from "@playwright/test";
import { seedWriting } from "../ux/writing-fixture";
import { openRoute } from "../ux/helpers";

test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const screen of ["reflection","prayer"] as const) {
  for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]])test(`Writing ${screen} ${width}`,async({page})=>{
    await page.setViewportSize({width,height});await seedWriting(page,screen);await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);
    await expect(page).toHaveScreenshot(`writing-${screen}-${width}.png`);
  });
  for(const state of ["empty","dark","enlarged","long","context","dialog","error"])test(`Writing ${screen} ${state}`,async({page})=>{
    await page.setViewportSize({width:state==="enlarged"?320:390,height:844});
    if(state==="dark")await page.emulateMedia({colorScheme:"dark"});
    if(state==="empty") {await openRoute(page,screen==="reflection"?"/today/reflection/2026-04-24":"/prayer/new");await expect(page.locator(".journal-textarea")).toBeVisible();}
    else await seedWriting(page,screen,state==="long");
    if(state==="enlarged")await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
    if(state==="context"){await page.locator(".journal-context summary").click();await expect(page.locator(".journal-scripture blockquote")).toContainText("For God so loved the world");}
    if(state==="dialog"){if(screen==="reflection")await page.getByLabel("Daily reflection").fill("Keep this unsaved writing.");await page.locator(".journal-heading .quiet-back-link").click();await expect(page.getByRole("dialog")).toBeVisible();}
    if(state==="error"){await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.put=function(...args){if(this.name==="reflections")throw new DOMException("Storage is unavailable.","QuotaExceededError");return original.apply(this,args);};IDBObjectStore.prototype.add=function(...args){if(this.name==="prayers")throw new DOMException("Storage is unavailable.","QuotaExceededError");return add.apply(this,args);};});if(screen==="reflection")await page.getByLabel("Daily reflection").fill("Keep this after failure.");await page.getByRole("button",{name:screen==="reflection"?"Save reflection":"Save prayer",exact:true}).click();await expect(page.locator(".journal-status")).toContainText("Storage is unavailable");}
    await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await expect(page).toHaveScreenshot(`writing-${screen}-${state}.png`,{fullPage:["enlarged","long","context","error"].includes(state)});
  });
}
test("Reflection preview and formatting",async({page})=>{
  await page.setViewportSize({width:390,height:844});await seedWriting(page,"reflection");
  await page.getByRole("button",{name:"Preview",exact:true}).click();await expect(page.locator(".journal-preview strong")).toHaveText("patience");
  await page.getByRole("button",{name:"Formatting",exact:true}).click();await page.getByRole("button",{name:"Optional prompts",exact:true}).click();
  await expect(page).toHaveScreenshot("writing-reflection-preview.png",{fullPage:true});
});
test("Prayer expanded details",async({page})=>{
  await page.setViewportSize({width:390,height:844});await seedWriting(page,"prayer");await page.getByRole("button",{name:"Add details",exact:true}).click();await expect(page.getByRole("combobox",{name:"Schedule",exact:true})).toBeVisible();
  await expect(page).toHaveScreenshot("writing-prayer-details.png",{fullPage:true});
});
test("Reflection conflict",async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await seedWriting(page,"reflection");await page.getByLabel("Daily reflection").fill("My unsaved writing.");
  const other=await context.newPage();await openRoute(other,"/today/reflection/2026-04-24");await other.getByLabel("Daily reflection").fill("The latest saved writing.");await other.getByRole("button",{name:"Save reflection",exact:true}).click();await expect(other.locator(".journal-status")).toContainText("saved locally");
  await page.getByRole("button",{name:"Save reflection",exact:true}).click();await expect(page.getByRole("region",{name:"Edit conflict"})).toBeVisible();await expect(page).toHaveScreenshot("writing-reflection-conflict.png",{fullPage:true});
});
