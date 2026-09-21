import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("dense secondary mobile workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("People and Categories put the editor before the saved list", async ({ page }) => {
    for (const route of ["/prayer/people", "/prayer/categories"]) {
      await openRoute(page, route);
      const editor = page.locator(".metadata-editor");
      const list = page.locator(".metadata-list");
      await expect(editor).toBeVisible();
      await expect(list).toBeVisible();
      const editorBox = await editor.boundingBox();
      const listBox = await list.boundingBox();
      expect(editorBox?.y ?? Infinity).toBeLessThan(listBox?.y ?? -Infinity);
      await expectNoHorizontalOverflow(page);
    }

    await openRoute(page, "/prayer/people");
    await page.getByLabel("Name", { exact: true }).fill("Anna");
    await page.getByLabel(/Relationship/).fill("Family");
    await page.getByRole("button", { name: "Add person", exact: true }).click();
    const row = page.locator(".metadata-row").filter({ hasText: "Anna" });
    await expect(row).toBeVisible();
    for (const name of ["Edit", "Remove"]) {
      const box = await row.getByRole("button", { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("Prayer detail is a compact mobile story with visible status context", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("Give wisdom and patience today.");
    await page.getByRole("button", { name: "Save prayer", exact: true }).click();
    await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Give wisdom and patience today.");

    const eyebrow = page.locator(".prayer-detail-heading .eyebrow");
    await expect(eyebrow).toBeVisible();
    await expect(eyebrow).toContainText("active");

    const lifecycle = page.locator(".prayer-lifecycle-actions");
    await expect(lifecycle).toHaveCSS("display", "grid");
    const buttons = lifecycle.getByRole("button");
    for (let index = 0; index < await buttons.count(); index += 1) {
      const box = await buttons.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await expect(page.locator(".prayer-detail-context")).toHaveCSS("display", "block");
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("Prayer Settings uses a flat form and sticky mobile save bar", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("Pray faithfully this week.");
    await page.getByRole("button", { name: "Save prayer", exact: true }).click();
    await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Pray faithfully this week.");
    await page.getByRole("link", { name: "Edit", exact: true }).click();

    await expect(page.locator(".prayer-settings-panel")).toBeVisible();
    const actions = page.locator(".prayer-settings-actions");
    await expect(actions).toHaveCSS("position", "sticky");
    const saveBox = await page.getByRole("button", { name: "Save details", exact: true }).boundingBox();
    expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });

  test("History Day keeps its date visible after the desktop title collapses", async ({ page }) => {
    await openRoute(page, "/history/day/2026-09-21");
    const context = page.locator(".history-day-screen .mg-secondary-header .eyebrow");
    await expect(context).toBeVisible();
    await expect(context).toContainText("2026");
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("History Moments uses a compact local mobile switcher", async ({ page }) => {
    await openRoute(page, "/history/moments");
    const tabs = page.locator(".mg-history-detail-workspace .history-tabs");
    await expect(tabs).toBeVisible();
    await expect(tabs).toHaveCSS("display", "flex");
    const links = tabs.getByRole("link");
    for (let index = 0; index < await links.count(); index += 1) {
      const box = await links.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("dense management screens remain usable at 320px and 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));

    for (const route of ["/prayer/people", "/prayer/categories", "/history/moments", "/history/day/2026-09-21"]) {
      await openRoute(page, route);
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("desktop secondary workflow composition remains unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/prayer/people");
    const editor = page.locator(".metadata-editor");
    const list = page.locator(".metadata-list");
    const editorBox = await editor.boundingBox();
    const listBox = await list.boundingBox();
    expect(editorBox?.x ?? 0).toBeGreaterThan(listBox?.x ?? Infinity);
  });
});
