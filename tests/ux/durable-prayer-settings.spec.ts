import {expect,test} from "@playwright/test";
import {seedPrayerDetail} from "./prayer-detail-fixture";
import {writingSnapshot} from "./writing-fixture";
import {openRoute,expectNoAxeViolations} from "./helpers";
test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));await seedPrayerDetail(page);await page.getByRole("link",{name:"Edit details",exact:true}).click();});
test("settings keep incomplete hidden fields across restart without saving a schedule",async({page})=>{
 const before=await writingSnapshot(page);await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("INTERVAL_DAYS");await page.getByLabel("Every",{exact:true}).fill("");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
 await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("MONTHLY");await page.getByLabel("Day of month",{exact:true}).fill("17");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");await page.reload();
 await openRoute(page,"/recovery");await page.getByRole("link",{name:/Prayer details/}).click();await page.getByRole("link",{name:"Review in Prayer",exact:true}).click();await page.getByRole("button",{name:"Recover for review",exact:true}).click();
 await expect(page.getByRole("combobox",{name:"Schedule",exact:true})).toHaveValue("MONTHLY");await expect(page.getByLabel("Day of month",{exact:true})).toHaveValue("17");await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("INTERVAL_DAYS");await expect(page.getByLabel("Every",{exact:true})).toHaveValue("");
 const domain=(rows:unknown[][])=>rows.filter(row=>!["editorDrafts","editorDraftContents","draftJournalState"].includes(String(row[0])));
 expect(domain(await writingSnapshot(page) as unknown[][])).toEqual(domain(before as unknown[][]));
 await page.getByRole("button",{name:"Save details",exact:true}).click();await expect(page.locator(".journal-status")).toContainText("between 1 and 3650");await expect(page).toHaveURL(/settings/);
 await page.getByLabel("Every",{exact:true}).fill("5");await page.getByRole("button",{name:"Save details",exact:true}).click();await expect(page.locator(".prayer-request")).toBeVisible();
 const after=Object.fromEntries(await writingSnapshot(page) as any);expect(after.prayers[0].revision).toBe(2);expect(after.prayerSchedules[0].intervalDays).toBe(5);expect(after.activityEvents).toHaveLength(0);await expectNoAxeViolations(page);
});
test("pristine settings and recovery offers do not create a draft or seed categories",async({page})=>{
 const before=await writingSnapshot(page);await page.getByRole("link",{name:"Manage categories",exact:true}).focus();await expect(page.getByRole("button",{name:"Save details",exact:true})).toBeDisabled();expect(await writingSnapshot(page)).toEqual(before);await expect(page.locator(".draft-status")).toBeEmpty();
});
test("discard waits for retirement before leaving the settings editor",async({page})=>{
 await page.getByRole("combobox",{name:"Schedule",exact:true}).selectOption("DAILY");await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");await page.getByRole("link",{name:"Cancel",exact:true}).click();await page.getByRole("dialog").getByRole("button",{name:"Discard and continue",exact:true}).click();await expect(page.locator(".prayer-request")).toBeVisible();
 const rows=Object.fromEntries(await writingSnapshot(page) as any);expect(rows.editorDraftContents).toHaveLength(0);expect(rows.prayers[0].revision).toBe(1);expect(rows.prayerSchedules).toHaveLength(0);expect(rows.activityEvents).toHaveLength(0);
});
