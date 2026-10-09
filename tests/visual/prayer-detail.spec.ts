import {expect,test} from "@playwright/test";
import {seedPrayerDetail,detailRoute} from "../ux/prayer-detail-fixture";
import {openRoute} from "../ux/helpers";
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const screen of ["detail","settings"] as const){
 for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]])test("Prayer "+screen+" "+width,async({page})=>{
  await page.setViewportSize({width,height});await seedPrayerDetail(page);
  await expect(page.locator(".prayer-request")).toBeVisible();await expect(page.locator(".prayer-record-person")).toContainText("Anna Wilson");
  if(screen==="settings"){await page.getByRole("link",{name:"Edit details",exact:true}).click();await expect(page.getByLabel("Person optional")).toHaveValue("00000000-0000-4000-8000-000000008002");}
  await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-"+screen+"-"+width+".png");
 });
 for(const state of ["dark","enlarged","long","answered","archived","waiting"])test("Prayer "+screen+" "+state,async({page})=>{
  await page.setViewportSize({width:state==="enlarged"?320:390,height:844});
  if(state==="dark")await page.emulateMedia({colorScheme:"dark"});
  await seedPrayerDetail(page,{status:["answered","archived","waiting"].includes(state)?state.toUpperCase():"ACTIVE",long:state==="long"});
  if(screen==="settings")await openRoute(page,detailRoute.replace("?","/settings?"));
  await expect(page.locator(screen==="detail"?".prayer-request":".prayer-settings-paper")).toBeVisible();
  if(state==="enlarged")await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
  if(screen==="detail"&&state==="enlarged"){
   const badge=await page.locator(".prayer-record-initials").evaluate(element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height,font:parseFloat(getComputedStyle(element).fontSize)}));
   expect(badge.width).toBeGreaterThanOrEqual(badge.font*2.1);expect(Math.abs(badge.width-badge.height)).toBeLessThan(1);
  }
  await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-"+screen+"-"+state+".png",{fullPage:true});
 });
}

for(const mode of ["DAILY","WEEKDAYS","INTERVAL_DAYS","MONTHLY","ON_DATE","MANUAL_ONLY"])test("Prayer settings mode "+mode,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption(mode);
 if(mode==="WEEKDAYS")await page.locator(".weekday-picker label").filter({hasText:"Mon"}).click(); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
 await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-settings-mode-"+mode.toLowerCase()+".png",{fullPage:true});
});
for(const state of ["scripture","timeline","wording","update","answer","confirmation","conflict","failure","unavailable"])test("Prayer detail state "+state,async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await seedPrayerDetail(page,{count:state==="timeline"?25:3});
 if(state==="scripture"){await page.locator("summary").filter({hasText:"Linked Scripture"}).click();await expect(page.locator(".journal-scripture blockquote")).toContainText("Devote yourselves to prayer");await page.locator("summary").filter({hasText:"From your reflection"}).click();}
 if(state==="timeline"){await page.getByRole("button",{name:"Show more",exact:true}).click();await expect(page.locator(".prayer-story-entry")).toHaveCount(25);}
 if(["wording","conflict","confirmation"].includes(state)){await page.getByRole("button",{name:"Edit wording",exact:true}).click();await page.getByLabel("Request",{exact:true}).fill("Help us listen with patience and walk with hope.");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");}
 if(state==="confirmation"){await page.locator(".journal-heading .quiet-back-link").click();await expect(page.getByRole("dialog")).toBeVisible();}
 if(state==="update"||state==="answer")await page.getByRole("button",{name:state==="update"?"Add update":"Mark answered",exact:true}).click();
 if(state==="conflict"){const other=await context.newPage();await openRoute(other,detailRoute);await other.getByRole("button",{name:"Edit wording",exact:true}).click();await other.getByLabel("Request",{exact:true}).fill("The saved request in another tab.");await other.getByRole("button",{name:"Save wording",exact:true}).click();await expect(other.locator(".prayer-request-text")).toHaveText("The saved request in another tab.");await expect(page.getByRole("button",{name:"Save wording",exact:true})).toBeDisabled();await page.getByRole("button",{name:"Compare versions",exact:true}).click();}
 if(state==="failure"){await page.addInitScript(()=>{const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){if(this.name==="prayers")throw new Error("Read unavailable");return get.apply(this,args);};});await page.reload();await expect(page.getByRole("button",{name:"Retry",exact:true})).toBeVisible();}
 if(state==="unavailable"){await openRoute(page,"/prayer/missing");await expect(page.getByRole("heading",{name:"Prayer unavailable"})).toBeVisible();}
 await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-detail-state-"+state+".png",{fullPage:state!=="confirmation"});
});
test("Prayer settings labeled conflict",async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();await page.getByLabel("Focus until",{exact:false}).fill("2026-05-01");const other=await context.newPage();await other.goto(page.url());await other.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("DAILY");await other.getByRole("button",{name:"Save details",exact:true}).click();await expect(other.locator(".prayer-request")).toBeVisible();await expect(page.getByRole("button",{name:"Save details",exact:true})).toBeDisabled();await page.getByRole("button",{name:"Compare versions",exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-settings-conflict.png",{fullPage:true});
});
for(const state of ["empty-story","remove-confirmation"])test("Prayer detail "+state,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedPrayerDetail(page,{count:state==="empty-story"?0:3});
 if(state==="remove-confirmation"){await page.getByText("More actions",{exact:true}).click();await page.getByRole("button",{name:"Remove prayer",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();}
 await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-detail-"+state+".png",{fullPage:state==="empty-story"});
});
for(const state of ["load-error","metadata-error"])test("Prayer settings "+state,async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();
 await page.addInitScript(({state})=>{const get=IDBObjectStore.prototype.get,cursor=IDBObjectStore.prototype.openCursor;IDBObjectStore.prototype.get=function(...args){if(state==="load-error"&&this.name==="prayers")throw new Error("Read unavailable");return get.apply(this,args);};IDBObjectStore.prototype.openCursor=function(...args){if(state==="metadata-error"&&this.name==="categories")throw new Error("Read unavailable");return cursor.apply(this,args);};},{state});
 await page.reload();await expect(page.getByRole("button",{name:state==="load-error"?"Retry":"Retry people and categories",exact:true})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await expect(page).toHaveScreenshot("prayer-settings-"+state+".png",{fullPage:true});
});
