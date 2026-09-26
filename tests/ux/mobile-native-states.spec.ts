import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

async function createPrayer(page: Page, body: string) {
  await openRoute(page, "/prayer/new");
  await page.getByLabel("What do you want to pray about?").fill(body);
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue(body);
  return page.url().split("#")[1]!;
}

test.describe("native mobile application states", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("unsaved-change confirmation is a bottom sheet with reachable actions", async ({ page }) => {
    await createPrayer(page, "Keep this request safe.");
    await page.getByLabel("Request", { exact: true }).fill("Keep this edited request safe.");
    await page.getByRole("button", { name: "Archive", exact: true }).click();

    const dialog = page.locator("dialog.draft-dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(380);
    expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 844)).toBeLessThanOrEqual(2);

    for (const name of ["Save and continue", "Discard and continue", "Keep editing"]) {
      const buttonBox = await page.getByRole("button", { name, exact: true }).boundingBox();
      // Chromium can report a 44px layout box as 43.9999847 during compositing.
      expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44 - 0.001);
    }

    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Keep this edited request safe.");
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("conflict review is an edge-to-edge mobile comparison state", async ({ page, context }) => {
    const route = await createPrayer(page, "Original request.");
    const other = await context.newPage();
    try {
      await other.setViewportSize({ width: 390, height: 844 });
      await openRoute(other, route);
      await other.getByLabel("Request", { exact: true }).fill("Saved in another tab.");
      await other.getByRole("button", { name: "Save wording", exact: true }).click();
      await expect(other.getByText("Prayer saved locally.")).toBeVisible();

      await page.getByLabel("Request", { exact: true }).fill("My local draft.");
      await page.getByRole("button", { name: "Save wording", exact: true }).click();

      const review = page.locator(".conflict-review");
      await expect(review).toBeVisible();
      await expect(page.getByLabel("Request", { exact: true })).toHaveValue("My local draft.");
      await page.getByRole("button", { name: "Review latest saved version", exact: true }).click();
      await expect(page.getByLabel("Your unsaved draft")).toHaveValue("My local draft.");
      await expect(page.getByLabel("Latest saved version")).toHaveValue("Saved in another tab.");

      const reviewBox = await review.boundingBox();
      expect(reviewBox?.width ?? 0).toBeGreaterThanOrEqual(380);
      for (const name of ["Use saved version", "Keep my draft"]) {
        const buttonBox = await page.getByRole("button", { name, exact: true }).boundingBox();
        expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page);
    } finally {
      await other.close();
    }
  });

  test("lazy-route failure becomes a compact recoverable mobile app state", async ({ page }) => {
    await page.route("**/assets/CollectionsScreen-*.js", (route) => route.abort());
    await openRoute(page, "/bible/collections");

    const state = page.locator(".mg-state-screen");
    await expect(state).toBeVisible();
    await expect(page.getByRole("heading", { name: "Couldn’t open this page." })).toBeVisible();

    const markBox = await page.locator(".mg-state-mark").boundingBox();
    expect(markBox?.width ?? Infinity).toBeLessThanOrEqual(36);
    for (const name of ["Reload MDD"]) {
      const buttonBox = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const returnBox = await page.getByRole("link", { name: "Return to Today", exact: true }).boundingBox();
    expect(returnBox?.height ?? 0).toBeGreaterThanOrEqual(44 - 0.001);
    await expectNoHorizontalOverflow(page);
    await page.unroute("**/assets/CollectionsScreen-*.js");
  });

  test("empty Prayer, Collections, and Search states stay compact", async ({ page }) => {
    await openRoute(page, "/prayer");
    const prayerEmpty = page.locator(".prayer-journal-empty");
    await expect(prayerEmpty).toBeVisible();
    await expect(prayerEmpty.locator("img")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await openRoute(page, "/bible/collections");
    await expect(page.locator(".mg-empty-state").filter({ hasText: "No collections yet." })).toBeVisible();

    await openRoute(page, "/search?q=zzzz-no-local-or-scripture-result-zzzz");
    const searchEmpty = page.locator(".search-empty");
    await expect(searchEmpty).toBeVisible();
    const searchBox = await searchEmpty.boundingBox();
    expect(searchBox?.height ?? Infinity).toBeLessThan(140);
    await expectNoHorizontalOverflow(page);
  });

  test("offline state is a slim system strip rather than a page banner", async ({ page, context }) => {
    await openRoute(page, "/today");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    const status = page.locator(".platform-status.is-offline");
    await expect(status).toBeVisible();
    const box = await status.boundingBox();
    expect(box?.height ?? Infinity).toBeLessThanOrEqual(52);
    await expectNoHorizontalOverflow(page);

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  });

  test("draft bottom sheet and state surfaces reflow at 320px and 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));

    await createPrayer(page, "A narrow-screen request.");
    await page.getByLabel("Request", { exact: true }).fill("A narrow-screen edited request.");
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.locator("dialog.draft-dialog")).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Keep editing", exact: true }).click();
    await openRoute(page, "/prayer/removed/settings");
    await expect(page.getByRole("heading", { name: "Prayer unavailable" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("desktop dialog and state composition remains centered", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await createPrayer(page, "Desktop state preservation.");
    await page.getByLabel("Request", { exact: true }).fill("Desktop state preservation edited.");
    await page.getByRole("button", { name: "Archive", exact: true }).click();

    const dialog = page.locator("dialog.draft-dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? Infinity).toBeLessThan(700);
    expect(box?.x ?? 0).toBeGreaterThan(200);
  });
});
