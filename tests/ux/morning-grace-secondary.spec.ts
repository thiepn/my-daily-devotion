import { expect, test } from "@playwright/test";
import { enrollCalendarPlan, expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

async function createPrayer(page) {
  await openRoute(page,"/prayer/new");
  await page.getByLabel("What do you want to pray about?").fill("Give wisdom and peace today.");
  await page.getByRole("button",{name:"Save prayer",exact:true}).click();
  await expect(page.getByLabel("Request",{exact:true})).toHaveValue("Give wisdom and peace today.");
  return new URL(page.url()).hash.replace(/^#/,"");
}

test.describe("Morning Grace secondary workflows",()=>{
  test("secondary workspaces use Morning Grace compositions",async({page})=>{
    await enrollCalendarPlan(page);

    await openRoute(page,"/today/reflection/2026-09-19");
    await expect(page.locator(".mg-reflection-workspace")).toBeVisible();

    await openRoute(page,"/today/plan");
    await expect(page.locator(".mg-plan-workspace")).toBeVisible();

    const prayerRoute=await createPrayer(page);
    await expect(page.locator(".mg-prayer-detail-workspace")).toBeVisible();

    await openRoute(page,prayerRoute+"/settings");
    await expect(page.locator(".mg-prayer-settings-workspace")).toBeVisible();

    await openRoute(page,"/prayer/people");
    await expect(page.locator(".mg-prayer-metadata-workspace")).toBeVisible();

    await openRoute(page,"/prayer/categories");
    await expect(page.locator(".mg-prayer-metadata-workspace")).toBeVisible();

    await openRoute(page,"/prayer/session?depth=quick");
    await expect(page.locator(".mg-focused-prayer-workspace")).toBeVisible();

    await openRoute(page,"/bible/collections");
    await expect(page.locator(".mg-collections-workspace")).toBeVisible();

    await openRoute(page,"/search");
    await expect(page.locator(".mg-search-workspace")).toBeVisible();

    await openRoute(page,"/data");
    await expect(page.locator(".mg-data-workspace")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("secondary workflows reflow on 320px phone",async({page})=>{
    await page.setViewportSize({width:320,height:568});
    await enrollCalendarPlan(page);
    const prayerRoute=await createPrayer(page);
    for(const route of [
      "/today/reflection/2026-09-19",
      "/today/plan",
      prayerRoute,
      prayerRoute+"/settings",
      "/prayer/people",
      "/prayer/categories",
      "/prayer/session?depth=quick",
      "/bible/collections",
      "/search",
      "/data"
    ]){
      await openRoute(page,route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("secondary workflows reflow at 200 percent text",async({page})=>{
    await page.setViewportSize({width:1280,height:900});
    await page.addInitScript(()=>document.addEventListener("DOMContentLoaded",()=>{document.documentElement.style.fontSize="200%";}));
    await enrollCalendarPlan(page);
    for(const route of ["/today/reflection/2026-09-19","/today/plan","/prayer/people","/prayer/categories","/bible/collections","/search","/data"]){
      await openRoute(page,route);
      await expect(page.locator("html")).toHaveCSS("font-size","32px");
      await expectNoHorizontalOverflow(page);
    }
  });
});
