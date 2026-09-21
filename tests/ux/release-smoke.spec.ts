import { expect, test } from "@playwright/test";
import { expectRouteTitle, openRoute } from "./helpers";

const primaryRoutes: Array<[string, string, string?]> = [
  ["/today", "Today"],
  ["/bible/JHN/3", "Bible"],
  ["/prayer", "Prayer"],
  ["/history", "History"],
  ["/search", "Search"],
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
      await expectRouteTitle(page, heading, mobileTitle ?? heading);
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("unknown deep links recover to Today instead of a blank application", async ({ page }) => {
    await page.goto("/#/this-route-does-not-exist");
    await expect(page).toHaveURL(/#\/today$/);
    await expectRouteTitle(page, "Today");
    await expect(page.locator("main").first()).toBeVisible();
  });
});
