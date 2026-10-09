import { expect, test } from "@playwright/test";
import { openRoute, expectNoHorizontalOverflow } from "./helpers";
import { writingSnapshot } from "./writing-fixture";

test.describe("P8 device lifecycle and storage failure resilience", () => {
  test("pagehide requests a durable checkpoint before the normal debounce interval", async ({ page }) => {
    await openRoute(page, "/today/reflection/2026-04-24");
    const text = "Offline P8 checkpoint on pagehide, not a devotional save.";
    await page.getByLabel("Daily reflection").fill(text);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await expect.poll(async () => {
      const rows = await writingSnapshot(page);
      const contents = rows.find(row => row[0] === "editorDraftContents")?.[1] as Array<{payload: {bodyMd?: string}}> | undefined;
      return contents?.some(row => row.payload.bodyMd === text) ?? false;
    }).toBe(true);
    const rows = await writingSnapshot(page);
    expect(rows.find(row => row[0] === "reflections")?.[1]).toEqual([]);
    await page.reload();
    await expect(page.getByLabel("Daily reflection")).toHaveValue("");
    const restarted = await writingSnapshot(page);
    const copies = restarted.find(row => row[0] === "editorDraftContents")?.[1] as Array<{payload: {bodyMd?: string}}> | undefined;
    expect(copies?.some(row => row.payload.bodyMd === text)).toBe(true);
  });

  test("quota-exceeded draft checkpoint shows a privacy-safe warning without clearing text", async ({ page }) => {
    await openRoute(page, "/bible/JHN/3?verse=16&endVerse=18");
    await page.getByRole("button", { name: "Add verse note" }).click();
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "editorDraftContents") throw new DOMException("Sensitive journal text must not appear in warnings.", "QuotaExceededError");
        return original.apply(this, args);
      };
    });
    await page.getByLabel("Verse note", { exact: true }).fill("Private notes remain in the editor during quota pressure.");
    await expect(page.locator(".platform-status")).toContainText("Local draft storage reported a full quota.");
    await expect(page.locator(".platform-status")).toContainText("do not clear site data");
    await expect(page.locator(".platform-status")).not.toContainText("Private notes remain in the editor");
    await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("Private notes remain in the editor during quota pressure.");
    await expectNoHorizontalOverflow(page);
  });

  test("estimated quota warning is advisory and disappears when the estimate recovers", async ({ page }) => {
    await openRoute(page, "/today");
    await page.evaluate(() => {
      Object.defineProperty(navigator.storage, "estimate", { configurable: true, value: async () => ({ usage: 95, quota: 100 }) });
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.locator(".platform-status")).toContainText("Browser storage is nearly full (estimate).");
    await page.evaluate(() => {
      Object.defineProperty(navigator.storage, "estimate", { configurable: true, value: async () => ({ usage: 10, quota: 100 }) });
      window.dispatchEvent(new Event("pageshow"));
    });
    await expect(page.getByText("Browser storage is nearly full (estimate).", { exact: false })).toHaveCount(0);
  });

  test("blocked vs completed database upgrade prevents reload during dirty writing", async ({ page }) => {
    await openRoute(page, "/today/reflection/2026-04-24");
    await page.getByLabel("Daily reflection").fill("Must remain in the editor during an upgrade.");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:database-connection", { detail: "blocked" })));
    await expect(page.locator(".platform-status")).toContainText("Another tab is blocking a storage update.");
    await expect(page.getByRole("button", { name: "Reload when ready" })).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:database-connection", { detail: "closed-for-upgrade" })));
    await expect(page.getByRole("button", { name: "Reload when ready" })).toBeDisabled();
    await expect(page.getByLabel("Daily reflection")).toHaveValue("Must remain in the editor during an upgrade.");
  });

  test("waiting service worker cannot update while the active editor is dirty", async ({ page }) => {
    await openRoute(page, "/today/reflection/2026-04-24");
    await page.getByLabel("Daily reflection").fill("Unsaved writing must keep this page from switching builds.");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:update-ready", { detail: { waiting: { postMessage() { throw new Error("Must not activate"); } } } })));
    await expect(page.getByRole("button", { name: "Reload to update" })).toBeDisabled();
    await expect(page.getByLabel("Daily reflection")).toHaveValue("Unsaved writing must keep this page from switching builds.");
  });
});
