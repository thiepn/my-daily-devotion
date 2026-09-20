import { expect, test } from "@playwright/test";
import { enrollCalendarPlan, expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("Morning Grace canonical screens", () => {
  test("canonical landmarks render after enrollment", async ({ page }) => {
    await enrollCalendarPlan(page);
    await openRoute(page, "/today");
    await expect(page.locator(".mg-today-hero")).toBeVisible();
    await expect(page.locator(".mg-reading-card")).toHaveCount(4);
    await expect(page.locator(".mg-response-section")).toBeVisible();

    await openRoute(page, "/bible/JHN/3");
    await expect(page.locator(".mg-bible-shell-header")).toBeVisible();
    const mobile = (page.viewportSize()?.width ?? 9999) <= 760;
    if (mobile) await expect(page.locator(".mg-bible-chapter-art")).toBeHidden();
    else await expect(page.locator(".mg-bible-chapter-art")).toBeVisible();
    await expect(page.locator(".mg-scripture-page .scripture-copy")).toBeVisible();

    await openRoute(page, "/prayer");
    await expect(page.locator(".mg-prayer-hero")).toBeVisible();
    await expect(page.locator(".mg-prayer-library")).toBeVisible();

    await openRoute(page, "/history");
    await expect(page.locator(".mg-history-hero")).toBeVisible();
    await expect(page.locator(".mg-history-overview")).toBeVisible();
    await expect(page.locator(".mg-history-calendar")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("canonical screens reflow cleanly on small phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const route of ["/today", "/bible/PSA/23", "/prayer", "/history"]) {
      await openRoute(page, route);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("canonical screens remain readable at 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));
    for (const route of ["/today", "/bible/ROM/8", "/prayer", "/history"]) {
      await openRoute(page, route);
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      await expectNoHorizontalOverflow(page);
    }
  });
});
