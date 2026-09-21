import { expect, test } from "@playwright/test";
import { expectCanonicalTitle, openRoute } from "./helpers";

const primaryRoutes: Array<[string, string, string]> = [
  ["/today", "Today", "Today"],
  ["/bible/JHN/3", "Bible", "Bible"],
  ["/prayer", "Prayer", "Prayer"],
  ["/history", "History", "History"],
  ["/search", "Search", "Search"],
  ["/data", "Your data", "Data and privacy"],
];

test.describe("release smoke", () => {
  test("primary surfaces cold-load without runtime errors", async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });

    for (const [route, heading, mobileTitle] of primaryRoutes) {
      await openRoute(page, route);
      if (heading === "Today" || heading === "Bible" || heading === "Prayer" || heading === "History") {
        await expectCanonicalTitle(page, heading);
      } else if ((page.viewportSize()?.width ?? 9999) <= 760) {
        await expect(page.locator(".utility-mobile-title")).toHaveText(mobileTitle);
        await expect(page.locator("h1").filter({ hasText: heading })).toHaveCount(1);
      } else {
        await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("unknown deep links recover to Today instead of a blank application", async ({ page }) => {
    await page.goto("/#/this-route-does-not-exist");
    await expect(page).toHaveURL(/#\/today$/);
    await expectCanonicalTitle(page, "Today");
    await expect(page.locator("main").first()).toBeVisible();
  });
});
