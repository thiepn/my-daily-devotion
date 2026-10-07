import {expect,test} from "@playwright/test";
import {seedPrayerDetail} from "../ux/prayer-detail-fixture";
import {expectNoHorizontalOverflow,expectNoAxeViolations} from "../ux/helpers";
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));});
for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]])test(`Prayer settings recovery ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("MONTHLY");await page.getByLabel("Day of month",{exact:true}).fill("17");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");await page.reload();await page.getByText("Kept drafts for this editor",{exact:true}).click();
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));window.scrollTo({top:0,behavior:"instant"});});await page.mouse.move(0,0);await expectNoHorizontalOverflow(page);await expect(page).toHaveScreenshot(`prayer-settings-recovery-${width}.png`,{fullPage:true});
});
for(const state of ["dark","text200","review","incomplete"])test("Prayer settings recovery "+state,async({page})=>{
 await page.setViewportSize({width:state==="text200"?320:390,height:844});if(state==="dark")await page.emulateMedia({colorScheme:"dark"});await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("INTERVAL_DAYS");await page.getByLabel("Every",{exact:true}).fill(state==="incomplete"?"":"5");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
 if(state==="review"){await page.reload();await page.getByText("Kept drafts for this editor",{exact:true}).click();await page.getByRole("button",{name:/Review kept draft/}).click();}if(state==="text200")await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));window.scrollTo({top:0,behavior:"instant"});});await page.mouse.move(0,0);await expectNoHorizontalOverflow(page);await expectNoAxeViolations(page);await expect(page).toHaveScreenshot(`prayer-settings-recovery-${state}.png`,{fullPage:true});
});
