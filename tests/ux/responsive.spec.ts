import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openRoute } from "./helpers";

const coreRoutes = ["/today", "/bible/JHN/3", "/prayer", "/history", "/search", "/data"];

test.describe("responsive and reflow UX", () => {
  test("320px mobile layouts keep primary journeys inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const route of coreRoutes) {
      await openRoute(page, route);
      await expectNoHorizontalOverflow(page);
    }
    await openRoute(page, "/today");
    const mobileNav = page.locator(".mobile-nav");
    await expect(mobileNav).toBeVisible();
    const targets = mobileNav.locator(".nav-link");
    for (let index = 0; index < await targets.count(); index += 1) {
      const box = await targets.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("200% text resizing does not create horizontal scrolling on core screens", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        document.documentElement.style.fontSize = "200%";
      });
    });
    for (const route of coreRoutes) {
      await openRoute(page, route);
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      expect(await page.locator(".brand-copy").evaluate((element) => element.scrollWidth - element.clientWidth), "Enlarged branding must remain inside the navigation rail").toBeLessThanOrEqual(1);
      await expectNoHorizontalOverflow(page);
    }
  });
});
