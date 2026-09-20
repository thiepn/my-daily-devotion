import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("Morning Grace final visual polish",()=>{
  test("mobile chrome is compact and accessible",async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await openRoute(page,"/today");
    const search=page.getByRole("link",{name:"Search",exact:true});
    const data=page.getByRole("link",{name:"Data",exact:true});
    await expect(search).toBeVisible();
    await expect(data).toBeVisible();
    await expect(search.locator(".icon-search")).toBeVisible();
    await expect(data.locator(".icon-settings")).toBeVisible();
    await expect(page.locator(".utility-bar .theme-switcher")).toBeHidden();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    await openRoute(page,"/data");
    await expect(page.locator(".mobile-appearance-panel")).toBeVisible();
    await expect(page.getByRole("button",{name:"Light theme"})).toBeVisible();
    await expect(page.getByRole("button",{name:"System theme"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Dark theme"})).toBeVisible();
  });

  test("residual secondary routes use final Morning Grace workspaces",async({page})=>{
    await openRoute(page,"/prayer/new");
    await expect(page.locator(".mg-prayer-capture-workspace")).toBeVisible();

    await openRoute(page,"/history/moments");
    await expect(page.locator(".mg-history-detail-workspace")).toBeVisible();

    await openRoute(page,"/history/day/2026-09-19");
    await expect(page.locator(".mg-history-detail-workspace")).toBeVisible();
  });

  test("polished routes reflow at 320px and 200 percent text",async({page})=>{
    await page.setViewportSize({width:320,height:568});
    for(const route of ["/prayer/new","/history/moments","/history/day/2026-09-19","/data","/search"]){
      await openRoute(page,route);
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({width:1280,height:900});
    await page.addInitScript(()=>document.addEventListener("DOMContentLoaded",()=>{document.documentElement.style.fontSize="200%";}));
    await page.reload();
    for(const route of ["/prayer/new","/history/moments","/data"]){
      await openRoute(page,route);
      await expect(page.locator("html")).toHaveCSS("font-size","32px");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("reduced motion removes route entrance animation",async({page})=>{
    await page.emulateMedia({reducedMotion:"reduce"});
    await openRoute(page,"/today");
    await expect(page.locator(".visual-screen")).toHaveCSS("animation-name","none");
  });
});
