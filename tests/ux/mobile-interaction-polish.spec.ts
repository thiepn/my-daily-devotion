import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("mobile interaction polish", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("pushed routes start at the top and app-bar Back restores source scroll", async ({ page }) => {
    await openRoute(page, "/bible/PSA/119");
    await expect(page.locator(".scripture-copy")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(1600);

    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);

    await page.getByRole("link", { name: "Search", exact: true }).click();
    await expect(page.locator(".utility-mobile-title")).toHaveText("Search");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(30);

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/bible\/PSA\/119$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);

    await page.locator(".mobile-nav").getByRole("link", { name: "Prayer", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(30);
  });

  test("destructive metadata actions use the in-app confirmation sheet", async ({ page }) => {
    await openRoute(page, "/prayer/people");
    await page.getByLabel("Name", { exact: true }).fill("Anna");
    await page.getByRole("button", { name: "Add person", exact: true }).click();

    const row = page.locator(".metadata-row").filter({ hasText: "Anna" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Remove", exact: true }).click();

    const dialog = page.locator("dialog.confirm-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("heading", { name: "Remove Anna?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();

    for (const name of ["Cancel", "Remove person"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    }

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Remove", exact: true }).click();
    await page.getByRole("button", { name: "Remove person", exact: true }).click();
    await expect(row).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("Prayer capture has keyboard save and focus clearance without changing Enter behavior", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    const editor = page.getByLabel("What do you want to pray about?");
    await expect(editor).toBeFocused();
    await expect(editor).toHaveCSS("scroll-margin-bottom", "96px");

    await editor.fill("A hardware-keyboard prayer.");
    await editor.press("Enter");
    await expect(editor).toHaveValue("A hardware-keyboard prayer.\n");

    await editor.press("Control+Enter");
    await expect(page.getByLabel("Request", { exact: true })).toHaveValue("A hardware-keyboard prayer.");
    await expect(page).toHaveURL(/#\/prayer\/[^/?]+/);
  });

  test("primary sticky editor actions retain 44px touch targets", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("Touch target check.");
    const save = page.getByRole("button", { name: "Save prayer", exact: true });
    const saveBox = await save.boundingBox();
    expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await openRoute(page, "/today/reflection/2026-09-22");
    await page.getByLabel("Daily reflection").fill("Touch target check.");
    const reflectionSave = page.getByRole("button", { name: "Save reflection", exact: true });
    const reflectionBox = await reflectionSave.boundingBox();
    expect(reflectionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });

  test("desktop confirmation remains a centered dialog", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/prayer/people");
    await page.getByLabel("Name", { exact: true }).fill("Desktop person");
    await page.getByRole("button", { name: "Add person", exact: true }).click();
    const row = page.locator(".metadata-row").filter({ hasText: "Desktop person" });
    await row.getByRole("button", { name: "Remove", exact: true }).click();

    const dialog = page.locator("dialog.confirm-dialog");
    const box = await dialog.boundingBox();
    expect(box?.width ?? Infinity).toBeLessThan(700);
    expect(box?.x ?? 0).toBeGreaterThan(200);
  });
});
