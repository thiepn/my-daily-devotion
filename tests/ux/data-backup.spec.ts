import { testOrigin } from "../../playwright.server";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { openRoute, expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";
import { chooseBackup, dataSnapshot, downloadBackup, fixtureBackup, portableFixtureData, reviewBackup, seedBackupData } from "./data-fixture";

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });

test("readonly browsing, export, review and cancellation preserve every live record", async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page);
  await page.getByText("Privacy", { exact: true }).click(); await page.getByText("Advanced", { exact: true }).click();
  const bytes = await downloadBackup(page);
  expect(JSON.parse(strFromU8(unzipSync(bytes)["data.json"]!))).toEqual(portableFixtureData(before));
  await expect(page.locator(".backup-receipt")).toContainText("Plain");
  await reviewBackup(page, bytes);
  await expect(page.locator(".backup-counts").getByText("Prayers", { exact: true }).locator("..")).toContainText("2");
  await page.getByText("All records & deletion markers", { exact: true }).click();
  await expect(page.locator(".backup-full-counts").first()).toContainText("2 saved · 1 removed");
  await page.getByRole("button", { name: "Cancel restore", exact: true }).click();
  await expect(page.locator("#backup-file")).toHaveValue("");
  expect(await dataSnapshot(page)).toEqual(before);
});

test("password confirmation, failed receipt and Markdown generation are independent", async ({ page }) => {
  await seedBackupData(page);
  await page.getByRole("button", { name: "Create encrypted backup", exact: true }).click();
  await page.getByLabel("Encrypted backup password", { exact: true }).fill("test-passphrase");
  await page.getByLabel("Confirm password", { exact: true }).fill("different-passphrase");
  await page.getByRole("button", { name: "Download encrypted backup", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("do not match");
  await page.getByRole("button", { name: "Show passwords", exact: true }).click();
  await expect(page.locator("#export-password")).toHaveAttribute("type", "text");
  await page.getByLabel("Confirm password", { exact: true }).fill("test-passphrase");
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === "mdd-backup-receipt-v1") throw new Error("Receipt storage denied"); return original.call(this, key, value); }; });
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download encrypted backup", exact: true }).click(); await pending;
  await expect(page.locator(".backup-panel .data-status")).toContainText("Download requested");
  await expect(page.locator(".backup-receipt")).toContainText("unavailable");
  expect(await page.evaluate(() => localStorage.getItem("mdd-backup-receipt-v1"))).toBeNull();
  await page.getByText("Other export options", { exact: true }).click();
  const markdown = page.waitForEvent("download"); await page.getByRole("button", { name: "Download Markdown archive" }).click(); const file = await markdown;
  const { readFile } = await import("node:fs/promises"); const files = unzipSync(await readFile((await file.path())!));
  expect(strFromU8(files["data.json"]!)).toContain("Retained removed writing.");
  expect(await page.evaluate(() => localStorage.getItem("mdd-backup-receipt-v1"))).toBeNull();
});

test("changed inputs invalidate review and replacement offers backup or explicit skip", async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page), bytes = fixtureBackup(before);
  await reviewBackup(page, bytes);
  await page.getByRole("radio", { name: /^Replace/ }).check(); await expect(page.locator(".backup-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview & validate", exact: true }).click(); await expect(page.locator(".backup-preview")).toBeVisible();
  await page.getByRole("button", { name: "Continue to confirmation" }).click();
  await expect(page.getByRole("button", { name: "Back up current data" })).toBeVisible();
  await page.getByRole("button", { name: "Skip backup" }).click(); await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep reviewing" })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
  await chooseBackup(page, bytes, "different-file.mddbackup"); await expect(page.locator(".backup-preview")).toHaveCount(0);
  expect(await dataSnapshot(page)).toEqual(before);
});

test("encrypted restore validates password, clears it on cancellation and preserves v1 backups", async ({ page, browser }) => {
  await seedBackupData(page); const bytes = await downloadBackup(page, "test-passphrase");
  const context = await browser.newContext({ baseURL: testOrigin, serviceWorkers: "block" });
  try {
    const fresh = await context.newPage(); await openRoute(fresh, "/data"); await chooseBackup(fresh, bytes);
    await fresh.getByLabel("Backup password", { exact: true }).fill("incorrect"); await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await expect(fresh.getByRole("alert")).toContainText("password is incorrect");
    await fresh.getByLabel("Backup password", { exact: true }).fill("test-passphrase"); await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await expect(fresh.locator(".backup-preview")).toBeVisible();
    await fresh.getByLabel("Backup password", { exact: true }).fill("changed"); await expect(fresh.locator(".backup-preview")).toHaveCount(0);
    await fresh.getByRole("button", { name: "Cancel restore" }).click(); await expect(fresh.getByLabel("Backup password", { exact: true })).toHaveCount(0);
    await chooseBackup(fresh, bytes); await fresh.getByLabel("Backup password", { exact: true }).fill("test-passphrase");
    await fresh.getByRole("radio", { name: /^Replace/ }).check(); await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await fresh.getByRole("button", { name: "Continue to confirmation" }).click();
    // A genuinely empty installation goes directly to the shared confirmation.
    await fresh.getByRole("button", { name: "Replace with validated backup" }).click();
    await expect(fresh.locator(".restore-result")).toBeVisible();
    expect((await dataSnapshot(fresh)).prayers).toHaveLength(3);
    await expect(fresh.getByLabel("Backup password", { exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});

test("concurrent changes require renewed review and failed commitment rolls back", async ({ page, context }) => {
  await seedBackupData(page); const bytes = fixtureBackup(await dataSnapshot(page)); await reviewBackup(page, bytes);
  const other = await context.newPage(); await openRoute(other, "/data?section=appearance");
  await other.locator(".data-journal").getByRole("button", { name: "Dark theme" }).click(); await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Continue to confirmation" }).click(); await page.getByRole("button", { name: "Merge validated backup" }).click();
  await expect(page.getByRole("alert")).toContainText("Local data changed"); await expect(page.locator(".backup-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Preview & validate" }).click(); await expect(page.locator(".backup-preview")).toBeVisible();
  const before = await dataSnapshot(page);
  await page.evaluate(() => { const original = IDBObjectStore.prototype.add; IDBObjectStore.prototype.add = function(...args) { if (this.transaction.db.name === "my-daily-devotion" && this.name === "prayers") throw new Error("Injected restore failure"); return original.apply(this, args); }; });
  await page.getByRole("button", { name: "Continue to confirmation" }).click(); await page.getByRole("button", { name: "Merge validated backup" }).click();
  await expect(page.getByRole("alert")).toContainText("Injected restore failure"); expect(await dataSnapshot(page)).toEqual(before);
});

test("successful restore followed by failed refresh cannot repeat the restore", async ({ page }) => {
  await seedBackupData(page); const incoming = await dataSnapshot(page);
  incoming.preferences = [{ key: "theme-mode", value: "dark", updatedAt: "2026-04-24T06:00:00.000Z" }];
  await reviewBackup(page, fixtureBackup(incoming));
  await page.evaluate(() => { const original = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function(...args) { if (this.name === "preferences") throw new Error("Refresh unavailable"); return original.apply(this, args); }; (window as unknown as { restoreGet: () => void }).restoreGet = () => { IDBObjectStore.prototype.get = original; }; });
  await page.getByRole("button", { name: "Continue to confirmation" }).click(); await page.getByRole("button", { name: "Merge validated backup" }).click();
  await expect(page.locator(".restore-result")).toBeVisible(); await expect(page.getByRole("button", { name: "Retry refresh", exact: true })).toBeVisible();
  const after = await dataSnapshot(page);
  await page.evaluate(() => (window as unknown as { restoreGet: () => void }).restoreGet());
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); expect(await dataSnapshot(page)).toEqual(after);
  await expect(page.getByRole("button", { name: "Merge validated backup" })).toHaveCount(0);
});

test("malformed, unsupported and relationally invalid archives remain harmless", async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page);
  await chooseBackup(page, Buffer.from("broken")); await expect(page.getByRole("alert")).toContainText("not a valid");
  await chooseBackup(page, fixtureBackup(before, { schemaVersion: 999 })); await expect(page.getByRole("alert")).toContainText("newer database schema");
  const invalid = structuredClone(before); (invalid.prayers![0] as { personId: string }).personId = "missing";
  await chooseBackup(page, fixtureBackup(invalid)); await page.getByRole("button", { name: "Preview & validate" }).click(); await expect(page.getByRole("alert")).toContainText("relational integrity");
  expect(await dataSnapshot(page)).toEqual(before);
});

test("contextual return and direct section focus preserve the full source URL", async ({ page }) => {
  await openRoute(page, "/prayer?status=WAITING"); const origin = page.getByRole("link", { name: "Data", exact: true }).visible(); await origin.click();
  await expect(page).toHaveURL(/return=%2Fprayer%3Fstatus%3DWAITING/); await page.locator(".journal-heading .quiet-back-link").click();
  await expect(page).toHaveURL(/#\/prayer\?status=WAITING$/); await expect(page.getByRole("link", { name: "Data", exact: true }).visible()).toBeFocused();
  await openRoute(page, "/data?section=privacy&return=%2Fhistory%3Fshown%3D25");
  await expect(page.locator("#data-privacy")).toHaveAttribute("open", ""); await expect(page.locator("#data-privacy summary")).toBeFocused();
  await expect(page.locator(".journal-heading .quiet-back-link")).toHaveAttribute("href", "#/history?shown=25");
});

test("appearance failures preserve the saved preference and shared controls recover together", async ({ page }) => {
  await openRoute(page, "/data?section=appearance"); const before = await dataSnapshot(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === "preferences") throw new Error("Appearance write denied"); return put.apply(this, args); };
    (window as unknown as { restorePut: () => void }).restorePut = () => { IDBObjectStore.prototype.put = put; };
  });
  await page.locator(".data-journal").getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator(".data-journal").getByRole("alert")).toContainText("could not be saved");
  expect(await dataSnapshot(page)).toEqual(before); await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => (window as unknown as { restorePut: () => void }).restorePut());
  await page.locator(".data-journal").getByRole("button", { name: "Dark theme" }).click();
  for (const control of await page.getByRole("button", { name: "Dark theme" }).all()) await expect(control).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".data-journal").getByRole("alert")).toHaveCount(0);
  const saved = await dataSnapshot(page); await page.locator(".data-journal").getByRole("button", { name: "Dark theme" }).click();
  expect(await dataSnapshot(page)).toEqual(saved);
});

test("journal controls retain contrast, keyboard targets and enlarged-text reflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await openRoute(page, "/data");
  await page.getByText("Appearance", { exact: true }).click();
  for (const theme of ["Light", "Dark"]) {
    await page.locator(".data-journal").getByRole("button", { name: theme + " theme" }).click();
    await page.getByRole("button", { name: "Create encrypted backup" }).click();
    await expectNoAxeViolations(page); await expectNoHorizontalOverflow(page);
    const sizes = await page.locator(".data-journal button:visible,.data-journal summary:visible,.data-journal input:visible,.journal-heading a").evaluateAll(items => items.map(item => ({ name: item.textContent, height: item.getBoundingClientRect().height, width: item.getBoundingClientRect().width })));
    for (const item of sizes) { expect(item.height, String(item.name)).toBeGreaterThanOrEqual(44); expect(item.width, String(item.name)).toBeGreaterThanOrEqual(44); }
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("button", { name: "Create encrypted backup" })).toBeFocused();
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.getByRole("button", { name: "Create encrypted backup" }).click(); await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
});

test("stale validation cannot return after a changed mode", async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page); await chooseBackup(page, fixtureBackup(before));
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle); let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const state = window as unknown as { validationEntered: boolean; releaseValidation: () => void };
    state.validationEntered = false; state.releaseValidation = () => { crypto.subtle.digest = original; release(); };
    crypto.subtle.digest = async (...args) => { state.validationEntered = true; await gate; return original(...args); };
  });
  await page.getByRole("button", { name: "Preview & validate" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { validationEntered: boolean }).validationEntered)).toBe(true);
  await page.getByRole("radio", { name: /^Replace/ }).check();
  await page.evaluate(() => (window as unknown as { releaseValidation: () => void }).releaseValidation());
  await expect(page.getByRole("button", { name: "Preview & validate" })).toBeEnabled();
  await expect(page.locator(".backup-preview")).toHaveCount(0); expect(await dataSnapshot(page)).toEqual(before);
});

test("replacement backup safeguard completes without claiming retained download", async ({ page }) => {
  await seedBackupData(page); await reviewBackup(page, fixtureBackup(await dataSnapshot(page)), "replace");
  await page.getByRole("button", { name: "Continue to confirmation" }).click(); await page.getByRole("button", { name: "Back up current data" }).click();
  await page.getByLabel("Encrypted backup password", { exact: true }).fill("test-passphrase"); await page.getByLabel("Confirm password").fill("test-passphrase");
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download encrypted backup" }).click(); await download;
  await expect(page.locator(".restore-status")).toContainText("Check that you have the file");
  await page.getByRole("button", { name: "Continue to confirmation" }).click(); await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep reviewing" }).click();
});

test("restore locks rapid submissions and guards navigation during commitment", async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page); await reviewBackup(page, fixtureBackup(before));
  await page.getByRole("button", { name: "Continue to confirmation" }).click();
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle); let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const state = window as unknown as { releaseCommit: () => void; clears: number };
    state.releaseCommit = () => { crypto.subtle.digest = original; release(); }; state.clears = 0;
    crypto.subtle.digest = async (...args) => { await gate; return original(...args); };
    const clear = IDBObjectStore.prototype.clear; IDBObjectStore.prototype.clear = function() { if (this.transaction.db.name === "my-daily-devotion") state.clears++; return clear.call(this); };
  });
  await page.getByRole("button", { name: "Merge validated backup" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click(); });
  await expect(page.getByRole("button", { name: "Restoring…", exact: true })).toBeDisabled();
  await page.evaluate(() => { document.querySelector<HTMLAnchorElement>('.journal-heading .quiet-back-link')!.click(); });
  await expect(page).toHaveURL(/#\/data$/);
  expect(await page.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; })).toBe(true);
  await page.evaluate(() => (window as unknown as { releaseCommit: () => void }).releaseCommit());
  await expect(page.locator(".restore-result")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { clears: number }).clears)).toBe(Object.keys(portableFixtureData(before)).length);
  expect(await dataSnapshot(page)).toEqual(before);
});
