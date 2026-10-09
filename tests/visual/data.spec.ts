import { expect, test } from "@playwright/test";
import { openRoute } from "../ux/helpers";
import { chooseBackup, dataSnapshot, fixtureBackup, reviewBackup, seedBackupData } from "../ux/data-fixture";
import { APP_VERSION } from "../../src/app/version";
import { DATABASE_SCHEMA_VERSION } from "../../src/data/schema";

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });
for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) test(`Data journal ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await openRoute(page, "/data"); await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`data-journal-${width}.png`, { fullPage: true });
});
for (const state of ["dark", "text200", "export", "password-mismatch", "export-dark", "review", "replace-offer", "replace-confirm", "replace-backup", "long-filename", "error", "success", "appearance", "privacy", "advanced"]) test(`Data ${state}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); if (state.includes("dark")) await page.emulateMedia({ colorScheme: "dark" });
  await openRoute(page, "/data");
  if (state === "text200") { await page.setViewportSize({ width: 320, height: 844 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); }
  if (["export", "password-mismatch", "export-dark", "text200"].includes(state)) {
    await page.getByRole("button", { name: "Create encrypted backup" }).click();
    if (state === "password-mismatch") { await page.getByLabel("Encrypted backup password").fill("test-passphrase"); await page.getByLabel("Confirm password").fill("different-password"); await page.getByRole("button", { name: "Download encrypted backup" }).click(); }
  }
  if (["review", "replace-offer", "replace-confirm", "replace-backup", "long-filename", "success"].includes(state)) {
    await seedBackupData(page); const backup = fixtureBackup(await dataSnapshot(page));
    if (state === "long-filename") await chooseBackup(page, backup, "My devotional journal with years of remembered prayers and reflections " + "long-name-".repeat(12) + ".mddbackup");
    else {
      await reviewBackup(page, backup, state.startsWith("replace") ? "replace" : "merge");
      if (state.startsWith("replace") || state === "success") await page.getByRole("button", { name: "Continue to confirmation" }).click();
      if (state === "replace-confirm") await page.getByRole("button", { name: "Skip backup" }).click();
      if (state === "replace-backup") await page.getByRole("button", { name: "Back up current data" }).click();
      if (state === "success") { await page.getByRole("button", { name: "Merge validated backup" }).click(); await expect(page.locator(".restore-result")).toBeVisible(); }
    }
  }
  if (state === "error") { await chooseBackup(page, Buffer.from("corrupt")); await expect(page.getByRole("alert")).toBeVisible(); }
  if (["appearance", "privacy", "advanced"].includes(state)) {
    await page.locator(`#data-${state} summary`).first().click();
    if (state === "advanced") { await expect(page.locator(".storage-facts")).not.toContainText("Checking"); await expect(page.getByText(`Version ${APP_VERSION} · Local database schema ${DATABASE_SCHEMA_VERSION} · Backup format 1`)).toBeVisible(); await page.locator(".storage-facts").evaluate(el => { el.querySelectorAll("dd")[1]!.textContent = "80 KB / 3.0 GB"; }); }
  }
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0);
  if (state !== "replace-confirm") await page.evaluate(() => window.scrollTo(0, 0));
  // Exact version/schema text is asserted above. Keep the shared image tolerance
  // for Windows host rasterization rather than requiring identical font pixels.
  await expect(page).toHaveScreenshot(`data-${state}.png`, { fullPage: state !== "replace-confirm" });
});
