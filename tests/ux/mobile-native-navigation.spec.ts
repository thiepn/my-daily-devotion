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
      await expect(page.locator(".mobile-appbar-back")).toHaveCount(0);
      await expect(page.locator(".utility-actions")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("secondary destinations behave like pushed app screens", async ({ page }) => {
    const routes: Array<[string, string]> = [
      ["/today/plan", "Reading plan"],
      ["/today/reflection/2026-09-21", "Reflection"],
      ["/bible/collections", "Scripture collections"],
      ["/prayer/new", "Add prayer"],
      ["/prayer/people", "Prayer people"],
      ["/prayer/categories", "Prayer categories"],
      ["/history/moments", "History moments"],
      ["/history/day/2026-09-21", "History day"],
      ["/search", "Search"],
      ["/data", "Data and privacy"],
    ];

    for (const [route, title] of routes) {
      await openRoute(page, route);
      await expect(page.locator(".app-shell")).toHaveClass(/mobile-detail-route/);
      await expect(page.locator(".utility-mobile-title")).toHaveText(title);
      await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
      await expect(page.locator(".mobile-nav")).toBeHidden();
      await expect(page.locator(".utility-actions")).toBeHidden();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("direct-open Back has a safe parent fallback", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer$/);
    await expect(page.locator(".mobile-nav")).toBeVisible();
  });

  test("Back returns to the actual source when a detail screen was pushed", async ({ page }) => {
    await openRoute(page, "/today/reflection/2026-09-21");
    await page.getByLabel("Daily reflection").fill("A saved reflection that becomes a prayer.");
    await page.getByRole("button", { name: "Save reflection" }).click();
    await expect(page.getByText(/Reflection (created and )?saved locally\./)).toBeVisible();
    await page.getByRole("link", { name: /Create prayer/ }).click();
    await expect(page.locator(".utility-mobile-title")).toHaveText("Add prayer");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/today\/reflection\/2026-09-21/);
    await expect(page.locator(".utility-mobile-title")).toHaveText("Reflection");
  });

  test("empty focused-prayer states retain pushed navigation", async ({ page }) => {
    await openRoute(page, "/prayer/session?depth=quick");
    await expect(page.locator(".app-shell")).toHaveClass(/mobile-immersive-route/);
    await expect(page.locator(".utility-bar")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
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

  test("pushed screens survive 320px width with 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));
    await openRoute(page, "/data");
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    const back = page.getByRole("button", { name: "Back", exact: true });
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
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expect(page.locator(".utility-actions")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("stacked navigation remains accessible", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await expectNoAxeViolations(page);
  });

  test("desktop keeps the existing Morning Grace secondary shell", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/prayer/new");
    await expect(page.locator(".side-rail")).toBeVisible();
    await expect(page.locator(".utility-actions")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeHidden();
    await expect(page.locator(".quiet-back-link")).toBeVisible();
    await expect(page.locator(".mobile-nav")).toBeHidden();
  });
});
