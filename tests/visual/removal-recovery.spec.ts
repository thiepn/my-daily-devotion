import { test, expect } from "@playwright/test";
import { seedRemoval } from "../ux/removal-fixture";
import { openRoute, expectNoHorizontalOverflow } from "../ux/helpers";
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) {
 test(`Removed writing ${width}`,async({page})=>{
  await page.setViewportSize({width,height});const id=await seedRemoval(page);await openRoute(page,`/recovery/removed/${id}?return=%2Fdata`);await expect(page.getByLabel("Reflection",{exact:true})).toHaveValue(/Current writing/);
  await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await expectNoHorizontalOverflow(page);await expect(page).toHaveScreenshot(`removed-writing-${width}.png`,{fullPage:true});
 });
}
for(const state of ["directory","empty","dark","enlarged","dialog","expired"]) {
 test(`Recently removed ${state}`,async({page})=>{
  await page.setViewportSize({width:state==="enlarged"?320:390,height:844});if(state==="dark")await page.emulateMedia({colorScheme:"dark"});
  if(state==="empty"){await openRoute(page,"/recovery?view=removed");await expect(page.getByRole("heading",{name:"Nothing recently removed."})).toBeVisible();}
  else {const id=await seedRemoval(page,state==="directory"?25:1);if(state==="expired")await page.clock.setFixedTime(new Date("2026-05-25T07:00:00+02:00"));await openRoute(page,state==="directory"?"/recovery?view=removed":`/recovery/removed/${id}?return=%2Fdata`);
   if(state==="directory")await expect(page.locator(".recovery-pagination")).toContainText("20 of 25 removals");else await expect(page.getByLabel("Reflection",{exact:true})).toBeVisible();
   if(state==="enlarged")await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});if(state==="dialog"){await page.getByRole("button",{name:"Restore removed records",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();}
  }
  await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await expectNoHorizontalOverflow(page);await expect(page).toHaveScreenshot(`removed-${state}.png`,{fullPage:true});
 });
}
