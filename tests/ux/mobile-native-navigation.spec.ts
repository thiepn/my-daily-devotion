import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("native mobile stacked navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("root destinations keep the four-tab mobile shell", async ({ page }) => {
    for (const route of ["/today", "/bible/JHN/3", "/prayer", "/history"]) {
      await openRoute(page, route);
      await expect(page.locator(".mobile-nav")).toBeVisible();
      await expect(page.locator(".utility-mobile-back")).toHaveCount(0);
      await expect(page.locator(".utility-actions")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("secondary destinations use a pushed screen with back navigation", async ({ page }) => {
    for (const route of [
      "/today/plan",
      "/today/reflection/2026-09-21",
      "/bible/collections",
      "/prayer/new",
      "/prayer/people",
      "/prayer/categories",
      "/history/moments",
      "/history/day/2026-09-21",
      "/search",
      "/data",
    ]) {
      await openRoute(page, route);
      await expect(page.locator(".app-shell")).toHaveClass(/mobile-detail-route/);
      await expect(page.locator(".utility-mobile-back")).toBeVisible();
      await expect(page.locator(".mobile-nav")).toBeHidden();
      await expect(page.locator(".utility-actions")).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("direct-open back navigation has a safe parent fallback", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/#\/prayer$/);
    await expect(page.locator(".mobile-nav")).toBeVisible();
  });

  test("empty focused-prayer states retain native pushed navigation", async ({ page }) => {
    await openRoute(page, "/prayer/session?depth=quick");
    await expect(page.locator(".app-shell")).toHaveClass(/mobile-immersive-route/);
    await expect(page.locator(".utility-bar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("an active focused-prayer session becomes immersive", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("Give wisdom and patience today.");
    await page.getByRole("button", { name: "Add details", exact: true }).click();
    await page.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("DAILY");
    await page.getByRole("button", { name: "Save prayer", exact: true }).click();
    await openRoute(page, "/prayer/session?depth=quick");
    await expect(page.locator(".mg-focused-prayer-workspace")).toBeVisible();
    await expect(page.locator(".utility-bar")).toBeHidden();
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("stacked mobile navigation remains accessible", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("pushed screens survive 320px width with 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));
    await openRoute(page, "/data");
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    const back = page.getByRole("button", { name: "Back" });
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });

  test("phone landscape keeps secondary routes in stacked-app mode", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openRoute(page, "/prayer/new");
    await expect(page.locator(".app-shell")).toHaveClass(/mobile-detail-route/);
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expect(page.locator(".utility-actions")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("desktop detail routes keep the Morning Grace desktop shell", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/prayer/new");
    await expect(page.locator(".side-rail")).toBeVisible();
    await expect(page.locator(".utility-actions")).toBeVisible();
    await expect(page.locator(".utility-mobile-back")).toBeHidden();
    await expect(page.locator(".mobile-nav")).toBeHidden();
  });
});
