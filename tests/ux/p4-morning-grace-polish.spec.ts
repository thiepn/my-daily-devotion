import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("P4 Morning Grace interaction and responsive audit", () => {
  test("history dates remain readable and correctly named at 320px and 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));
    await openRoute(page, "/today/reflection/2026-09-17");
    await page.getByLabel("Daily reflection").fill("A quiet day recorded for calendar accessibility.");
    await page.getByRole("button", { name: "Save reflection" }).click();
    await expect(page.getByText("Reflection created and saved locally.")).toBeVisible();

    await openRoute(page, "/history/calendar?month=2026-09");
    await expect(page.locator(".history-calendar-grid")).toBeHidden();
    const list = page.locator(".history-calendar-day-list");
    await expect(list).toBeVisible();
    const record = list.getByRole("link", { name: /September 17.*recorded.*event/i });
    await expect(record).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await record.click();
    await expect(page.locator(".history-day-screen")).toBeVisible();
  });

  test("calendar empty dates have a complete accessible text alternative on normal phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, "/history/calendar?month=2026-09");
    const grid = page.locator(".history-calendar-grid");
    await expect(grid).toBeVisible();
    const empty = grid.locator(".history-day.empty").first();
    await expect(empty.locator(".sr-only")).toContainText(/no recorded history/i);
    await expect(empty.locator('[aria-hidden="true"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("journal confirmation remains named, scrollable and usable on a short 320px phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("A saved prayer with meaningful writing.");
    await page.getByRole("button", { name: "Save prayer", exact: true }).click();
    await expect(page.locator(".prayer-request-text")).toBeVisible();
    await page.getByRole("button", { name: "Edit wording", exact: true }).click();
    await page.getByLabel("Request", { exact: true }).fill("My changed prayer wording should remain unsaved.");
    await page.getByText("More actions", { exact: true }).click();
    await page.getByRole("button", { name: "Archive prayer", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Keep your unsaved changes?" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: "Keep editing", exact: true })).toBeVisible();
    const bounds = await modal.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(320);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568 + 1);
    await expectNoHorizontalOverflow(page);
    await modal.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page.getByLabel("Request", { exact: true })).toHaveValue("My changed prayer wording should remain unsaved.");
  });

  test("records real-rendered Morning Grace layout evidence without altering reference baselines", async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const routes = [
      ["today", "/today"],
      ["bible", "/bible/JHN/3"],
      ["prayer", "/prayer"],
      ["history", "/history"],
    ] as const;
    for (const [width, height] of [[320, 568], [430, 932], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      for (const [label, path] of routes) {
        await openRoute(page, path);
        await page.evaluate(async () => { await document.fonts.ready; });
        await expectNoHorizontalOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`morning-grace-${label}-${width}-light.png`), animations: "disabled" });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    for (const [label, path] of routes) {
      await openRoute(page, path);
      await page.evaluate(async () => { await document.fonts.ready; });
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`morning-grace-${label}-390-dark.png`), animations: "disabled" });
    }
  });

  test("primary Morning Grace destinations preserve unique navigation focus and no overflow", async ({ page }) => {
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/today", "/bible/JHN/3", "/prayer", "/history"]) {
        await openRoute(page, path);
        await expect(page.locator("nav[aria-label='Primary']:visible")).toHaveCount(1);
        await expectNoHorizontalOverflow(page);
      }
    }
  });
});
