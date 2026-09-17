import { expect, test } from "@playwright/test";
import { enrollCalendarPlan, expectNoAxeViolations, openRoute, visibleNavLink } from "./helpers";

test.describe("accessibility and keyboard UX", () => {
  test("major empty-state surfaces have no automated WCAG A/AA violations", async ({ page }) => {
    const routes: Array<[string, string]> = [
      ["/today", "Today"],
      ["/bible/JHN/3", "Bible"],
      ["/prayer", "Prayer"],
      ["/history", "History"],
      ["/search", "Search"],
      ["/data", "Your data"],
    ];
    for (const [route, heading] of routes) {
      await openRoute(page, route);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoAxeViolations(page);
    }
  });

  test("skip navigation and SPA route changes put keyboard focus at the content boundary", async ({ page }) => {
    await openRoute(page, "/today");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const bible = visibleNavLink(page, "Bible");
    await bible.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Bible" })).toBeVisible();
    await expect(page.locator("#main-content")).toBeFocused();
    await expect(page).toHaveTitle("Bible — My Daily Devotion");
  });

  test("date and calendar controls have meaningful accessible names", async ({ page }) => {
    await openRoute(page, "/today");
    await expect(page.getByLabel("Completed through date")).toBeVisible();
    await enrollCalendarPlan(page);
    await page.getByRole("link", { name: "Open full plan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Reading plan" })).toBeVisible();
    await expect(page.getByLabel("Completed through date")).toBeVisible();

    await openRoute(page, "/history");
    await expect(page.getByRole("button", { name: "Previous month" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();
  });

  test("dark theme remains free of automated color-contrast failures", async ({ page }) => {
    await openRoute(page, "/bible/JHN/3");
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectNoAxeViolations(page);
  });
});
