import { expect, test } from "@playwright/test";
import { openRoute } from "./helpers";

const primaryRoutes = [
  "/today",
  "/bible/JHN/3",
  "/prayer",
  "/history",
  "/search",
  "/data",
];

test.describe("release smoke", () => {
  test("primary surfaces cold-load without runtime errors", async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(`console: ${message.text()}`);
    });

    for (const route of primaryRoutes) {
      await openRoute(page, route);
      await expect(page.locator("h1").first()).toBeVisible();
    }

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("unknown deep links recover to Today instead of a blank application", async ({ page }) => {
    await page.goto("/#/this-route-does-not-exist");
    await expect(page).toHaveURL(/#\/today$/);
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.locator("main").first()).toBeVisible();
  });
});
