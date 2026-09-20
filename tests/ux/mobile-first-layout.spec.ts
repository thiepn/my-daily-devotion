import { expect, test } from "@playwright/test";
import { enrollCalendarPlan, expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("mobile-first Morning Grace layout",()=>{
  test.beforeEach(async({page})=>{
    await page.setViewportSize({width:390,height:844});
  });

  test("Today is compact and reading-first",async({page})=>{
    await enrollCalendarPlan(page);
    await expect(page.locator(".mg-hero-art")).toBeHidden();
    await expect(page.locator(".mg-reading-card")).toHaveCount(4);

    const appbar=await page.locator(".utility-bar").boundingBox();
    const tabbar=await page.locator(".mobile-nav").boundingBox();
    expect(appbar?.height??999).toBeLessThanOrEqual(52);
    expect(tabbar?.height??999).toBeLessThanOrEqual(66);

    for(const row of await page.locator(".mg-reading-card").all()){
      const box=await row.boundingBox();
      expect(box?.height??999).toBeLessThanOrEqual(76);
    }

    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("Bible opens directly into reading content",async({page})=>{
    await openRoute(page,"/bible/JHN/3");
    await expect(page.locator(".mg-bible-chapter-art")).toBeHidden();
    await expect(page.locator(".mg-bible-shell-header > div:first-child")).toBeHidden();
    await expect(page.locator(".mg-scripture-page .scripture-copy")).toBeVisible();

    const toolbar=await page.locator(".mg-bible-toolbar").boundingBox();
    const reader=await page.locator(".mg-reader-heading").boundingBox();
    expect((toolbar?.height??999)).toBeLessThanOrEqual(92);
    expect((reader?.y??999)).toBeLessThan(260);
    await expectNoHorizontalOverflow(page);
  });

  test("Prayer and History use compact mobile compositions",async({page})=>{
    await openRoute(page,"/prayer");
    await expect(page.locator(".mg-prayer-hero-art")).toBeHidden();
    await expect(page.locator(".mg-prayer-library")).toBeVisible();
    await expect(page.locator(".prayer-status-tabs")).toBeVisible();
    const prayerHero=await page.locator(".mg-prayer-hero").boundingBox();
    expect(prayerHero?.height??999).toBeLessThanOrEqual(260);

    await openRoute(page,"/history");
    await expect(page.locator(".mg-history-hero-art")).toBeHidden();
    const stats=page.locator(".mg-history-stats");
    await expect(stats).toBeVisible();
    const columns=await stats.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(3);
    await expectNoHorizontalOverflow(page);
  });

  test("Appearance lives in Data rather than the phone app bar",async({page})=>{
    await openRoute(page,"/today");
    await expect(page.locator(".utility-bar .theme-switcher")).toBeHidden();
    await openRoute(page,"/data");
    await expect(page.locator(".mobile-appearance-panel")).toBeVisible();
    await expect(page.getByRole("button",{name:"Light theme"})).toBeVisible();
    await expect(page.getByRole("button",{name:"System theme"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Dark theme"})).toBeVisible();
  });

  test("phone layouts remain clean at 320px and enlarged text",async({page})=>{
    await page.setViewportSize({width:320,height:568});
    for(const route of ["/today","/bible/PSA/23","/prayer","/history","/today/plan","/prayer/new","/search","/data"]){
      await openRoute(page,route);
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({width:390,height:844});
    await page.addInitScript(()=>document.addEventListener("DOMContentLoaded",()=>{document.documentElement.style.fontSize="200%";}));
    await page.reload();
    for(const route of ["/today","/bible/ROM/8","/prayer","/history"]){
      await openRoute(page,route);
      await expect(page.locator("html")).toHaveCSS("font-size","32px");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("desktop composition is untouched by the phone-only layer",async({page})=>{
    await page.setViewportSize({width:1280,height:900});
    await openRoute(page,"/today");
    await expect(page.locator(".mg-hero-art")).toBeVisible();
    const hero=await page.locator(".mg-canonical-hero").boundingBox();
    expect(hero?.height??0).toBeGreaterThan(220);
    await openRoute(page,"/bible/JHN/3");
    await expect(page.locator(".mg-bible-chapter-art")).toBeVisible();
  });
});
