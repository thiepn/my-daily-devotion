import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("native mobile interaction polish", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("app-bar Back consumes in-app history without reopening the pushed screen", async ({ page }) => {
    await openRoute(page, "/today");
    await page.locator(".mobile-nav").getByRole("link", { name: "Prayer", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer$/);

    await page.getByRole("link", { name: "Add prayer", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer\/new$/);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer$/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/today$/);
    await expect(page.locator(".utility-mobile-title")).toHaveText("Today");
  });

  test("pushed non-reader routes reset stale document scroll", async ({ page }) => {
    await openRoute(page, "/history");
    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 900);
    });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

    await page.evaluate(() => { window.location.hash = "#/prayer/people"; });
    await expect(page.locator(".utility-mobile-title")).toHaveText("Prayer people");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("dirty navigation uses the in-app bottom sheet instead of browser confirm chrome", async ({ page }) => {
    await openRoute(page, "/today/reflection/2026-09-22");
    const editor = page.getByLabel("Daily reflection");
    await editor.fill("Keep this reflection draft.");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Leave without saving?" })).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(380);
    expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 844)).toBeLessThanOrEqual(2);

    await dialog.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page).toHaveURL(/#\/today\/reflection\/2026-09-22$/);
    await expect(editor).toHaveValue("Keep this reflection draft.");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Leave without saving", exact: true }).click();
    await expect(page).toHaveURL(/#\/today$/);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("destructive actions use the shared in-app confirmation sheet", async ({ page }) => {
    await openRoute(page, "/prayer/categories");
    await page.locator(".metadata-editor").getByLabel("Name").fill("Temporary");
    await page.getByRole("button", { name: "Add category", exact: true }).click();
    await expect(page.locator(".metadata-row").filter({ hasText: "Temporary" })).toBeVisible();

    await page.locator(".metadata-row").filter({ hasText: "Temporary" }).getByRole("button", { name: "Remove", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Remove category?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Remove category", exact: true }).click();
    await expect(page.locator(".metadata-row").filter({ hasText: "Temporary" })).toHaveCount(0);
  });

  test("Search requests the native search keyboard contract", async ({ page }) => {
    await openRoute(page, "/search");
    const input = page.getByLabel("Search MDD");
    await expect(input).toHaveAttribute("type", "search");
    await expect(input).toHaveAttribute("inputmode", "search");
    await expect(input).toHaveAttribute("enterkeyhint", "search");
    await expect(input).toHaveAttribute("autocapitalize", "none");
    await expect(input).toHaveAttribute("autocorrect", "off");
  });

  test("mobile chrome exposes manipulation touch behavior without horizontal overflow", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    const back = page.getByRole("button", { name: "Back", exact: true });
    await expect(back).toHaveCSS("touch-action", "manipulation");
    await expectNoHorizontalOverflow(page);
  });
});
