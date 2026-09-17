import { expect, test } from "@playwright/test";

test.describe("offline PWA UX", () => {
  test("a controlled cold start can read Scripture and search while fully offline", async ({ context, page }) => {
    test.setTimeout(120_000);
    await page.goto("/#/bible/JHN/3");
    await expect(page.getByRole("heading", { level: 2, name: "John 3" })).toBeVisible();
    await page.waitForFunction(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    }, undefined, { timeout: 90_000 });

    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20_000 });
    await page.close();
    await context.setOffline(true);

    const coldPage = await context.newPage();
    await coldPage.goto("/#/bible/JHN/3", { waitUntil: "domcontentloaded" });
    await expect(coldPage.getByRole("heading", { level: 1, name: "Bible" })).toBeVisible();
    await expect(coldPage.getByRole("heading", { level: 2, name: "John 3" })).toBeVisible();
    await expect(coldPage.getByRole("button", { name: "Select John 3:16" })).toBeVisible();

    await coldPage.evaluate(() => { window.location.hash = "#/search"; });
    await expect(coldPage.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
    await coldPage.getByLabel("Search MDD").fill("John 3:16");
    await coldPage.getByRole("button", { name: "Search", exact: true }).click();
    await expect(coldPage.getByText("John 3:16", { exact: true }).first()).toBeVisible();
    await expect(coldPage.locator(".platform-status")).toContainText(/Offline|offline/i);
  });
});
