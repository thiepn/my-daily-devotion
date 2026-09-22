import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("mobile interaction polish", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("route-level unsaved changes use the app bottom sheet instead of a browser confirm", async ({ page }) => {
    const nativeDialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      nativeDialogs.push(dialog.type());
      await dialog.dismiss();
    });

    await openRoute(page, "/today/reflection/2026-09-22");
    const editor = page.getByLabel("Daily reflection");
    await editor.fill("Keep this mobile draft.");
    await page.getByRole("button", { name: "Back", exact: true }).click();

    const dialog = page.locator("dialog.navigation-draft-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Leave without saving?" })).toBeVisible();
    expect(nativeDialogs).toEqual([]);

    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(380);
    expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 844)).toBeLessThanOrEqual(2);

    for (const name of ["Keep editing", "Leave without saving"]) {
      const buttonBox = await dialog.getByRole("button", { name, exact: true }).boundingBox();
      expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await dialog.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(editor).toHaveValue("Keep this mobile draft.");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Leave without saving", exact: true }).click();
    await expect(page).toHaveURL(/#\/today$/);
    await expect(page.locator(".mobile-nav")).toBeVisible();
  });

  test("revisiting a mobile screen restores its own scroll position", async ({ page }) => {
    await openRoute(page, "/today");
    await page.getByRole("link", { name: "Data", exact: true }).click();
    await expect(page.locator(".utility-mobile-title")).toHaveText("Data and privacy");
    await expect(page.locator(".mg-data-workspace")).toBeVisible();

    await page.addStyleTag({ content: ".mg-data-workspace { min-height: 2400px !important; }" });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThan(1000);
    await page.evaluate(() => window.scrollTo(0, 720));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(680);
    const saved = await page.evaluate(() => window.scrollY);

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/today$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(8);

    await page.getByRole("link", { name: "Data", exact: true }).click();
    await expect(page.locator(".utility-mobile-title")).toHaveText("Data and privacy");
    await expect.poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - saved)).toBeLessThan(8);
  });

  test("mobile controls expose keyboard-safe scroll margins and direct tap handling", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    const editor = page.getByLabel("What do you want to pray about?");
    const save = page.getByRole("button", { name: "Save prayer", exact: true });

    const editorMetrics = await editor.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        top: Number.parseFloat(style.scrollMarginTop),
        bottom: Number.parseFloat(style.scrollMarginBottom),
      };
    });
    const touchAction = await save.evaluate((node) => getComputedStyle(node).touchAction);

    expect(editorMetrics.top).toBeGreaterThanOrEqual(48);
    expect(editorMetrics.bottom).toBeGreaterThanOrEqual(60);
    expect(touchAction).toBe("manipulation");

    await editor.focus();
    await expect(editor).toBeFocused();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("navigation draft sheet reflows at 320px and 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));

    await openRoute(page, "/today/reflection/2026-09-22");
    await page.getByLabel("Daily reflection").fill("Large text draft.");
    await page.getByRole("button", { name: "Back", exact: true }).click();

    const dialog = page.locator("dialog.navigation-draft-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(318);
    expect(box?.height ?? Infinity).toBeLessThanOrEqual(568);
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("navigation draft sheet remains usable on a landscape phone", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openRoute(page, "/today/reflection/2026-09-22");
    await page.getByLabel("Daily reflection").fill("Landscape draft.");
    await page.getByRole("button", { name: "Back", exact: true }).click();

    const dialog = page.locator("dialog.navigation-draft-dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.height ?? Infinity).toBeLessThanOrEqual(390);
    for (const name of ["Keep editing", "Leave without saving"]) {
      const buttonBox = await dialog.getByRole("button", { name, exact: true }).boundingBox();
      expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("desktop keeps the centered navigation draft dialog", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/today/reflection/2026-09-22");
    await page.getByLabel("Daily reflection").fill("Desktop draft.");
    await page.locator(".side-nav").getByRole("link", { name: "Today", exact: true }).click();

    const dialog = page.locator("dialog.navigation-draft-dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? Infinity).toBeLessThan(700);
    expect(box?.x ?? 0).toBeGreaterThan(200);
  });
});
