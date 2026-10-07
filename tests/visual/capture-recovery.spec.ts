import { expect, test } from "@playwright/test";
import { openRoute, expectNoHorizontalOverflow, expectNoAxeViolations } from "../ux/helpers";
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });
const field = "What do you want to pray about?";
for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) {
  test(`Capture recovery ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await openRoute(page, "/prayer/new");
    await page.getByLabel(field).fill("Give me patience and wisdom in the conversations ahead.");
    await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
    await page.reload(); await expect(page.getByLabel(field)).toBeEmpty();
    await page.getByText("Kept drafts for this editor", { exact: true }).click();
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(0,0);
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(`capture-recovery-${width}.png`, { fullPage: true });
  });
}
for (const state of ["dialog", "details", "dark", "enlarged", "kept", "storage-failure"]) {
  test(`Capture recovery ${state}`, async ({ page }) => {
    await page.setViewportSize({ width: state === "enlarged" ? 320 : 390, height: 844 });
    if (state === "dark") await page.emulateMedia({ colorScheme: "dark" });
    await openRoute(page, "/prayer/new?translation=BSB&start=JHN.3.16&end=JHN.3.18&sourceDevotionDate=2026-04-24");
    if (state === "storage-failure") await page.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === "editorDraftContents") throw new DOMException("Draft storage unavailable", "QuotaExceededError"); return original.apply(this, args); }; });
    await page.getByLabel(field).fill("Give me patience and wisdom in the conversations ahead.");
    if (state === "storage-failure") await expect(page.getByRole("alert")).toContainText("Draft could not be kept");
    else await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
    if (!["kept", "storage-failure"].includes(state)) {
      await page.reload(); await page.getByText("Kept drafts for this editor", { exact: true }).click();
      await page.getByRole("button", { name: /Review kept draft/ }).click(); await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (state === "enlarged") await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    if (state === "details") await page.locator(".draft-comparison-details summary").first().click();
    await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(0,0);
    await expect(page).toHaveScreenshot(`capture-recovery-${state}.png`, { fullPage: true });
  });
}
