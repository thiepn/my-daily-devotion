import { expect, test } from "@playwright/test";
import { openRoute } from "./helpers";

test.describe("mobile native back navigation", () => {
  test("secondary routes put Back in the phone app bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const [route, title] of [
      ["/today/plan", "Reading plan"],
      ["/today/reflection/2026-09-21", "Reflection"],
      ["/bible/collections", "Scripture collections"],
      ["/prayer/new", "Add prayer"],
      ["/prayer/people", "Prayer people"],
      ["/history/moments", "History moments"],
      ["/search", "Search"],
      ["/data", "Data and privacy"],
    ]) {
      await openRoute(page, route);
      await expect(page.locator(".utility-mobile-title")).toHaveText(title);
      await expect(page.getByRole("link", { name: "Back", exact: true })).toBeVisible();
      const contentBack = page.locator(".quiet-back-link");
      if (await contentBack.count()) await expect(contentBack.first()).toBeHidden();
    }
  });

  test("mobile Back returns to the correct parent surface", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await openRoute(page, "/bible/collections");
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/bible$/);

    await openRoute(page, "/prayer/new");
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer$/);

    await openRoute(page, "/history/moments");
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/history$/);
  });

  test("desktop keeps existing in-content navigation and hides phone Back", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/prayer/new");
    await expect(page.getByRole("link", { name: "Back", exact: true })).toBeHidden();
    await expect(page.locator(".quiet-back-link")).toBeVisible();
  });
});
