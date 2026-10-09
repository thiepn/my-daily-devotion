import { expect, test } from "@playwright/test";
import { openRoute, expectNoHorizontalOverflow, expectNoAxeViolations } from "../ux/helpers";
const route = "/bible/JHN/3?verse=16&endVerse=18&return=%2Fhistory%3Fshown%3D15";
const writing = "Help me receive this promise with trust, and carry its hope into the people I meet today.";
async function settleReader(page: import("@playwright/test").Page) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); window.scrollTo({top:0,behavior:"instant"}); });
}
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });
for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) {
  test(`Verse note recovery ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await openRoute(page, route); await page.getByRole("button", { name: "Add verse note", exact: true }).click();
    await page.getByLabel("Verse note", { exact: true }).fill(writing); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(0,0); await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
    await settleReader(page); await expect(page).toHaveScreenshot(`notes-recovery-${width}.png`);
  });
}
for (const state of ["dark", "enlarged", "dialog", "storage-failure", "long-writing", "discard", "conflict", "removed"]) {
  test(`Verse note recovery ${state}`, async ({ page }) => {
    await page.setViewportSize({ width: state === "enlarged" ? 320 : 390, height: 844 });
    if (state === "dark") await page.emulateMedia({ colorScheme: "dark" });
    await openRoute(page, route); await page.getByRole("button", { name: "Add verse note", exact: true }).click();
    if (["conflict", "removed"].includes(state)) { await page.getByLabel("Verse note", { exact: true }).fill("The earlier saved note."); await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally"); }
    if (state === "storage-failure") await page.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === "editorDraftContents") throw new DOMException("Draft storage unavailable", "QuotaExceededError"); return original.apply(this, args); }; });
    await page.getByLabel("Verse note", { exact: true }).fill(state === "long-writing" ? (writing + "\n\n").repeat(30) : writing);
    if (state === "storage-failure") await expect(page.getByRole("alert")).toContainText("Draft could not be kept");
    else await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
    if (["conflict", "removed"].includes(state)) {
      await page.evaluate(async removed => {
        const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
        await new Promise<void>((resolve, reject) => { const tx = database.transaction("verseNotes", "readwrite"), store = tx.objectStore("verseNotes"), request = store.getAll(); request.onsuccess = () => { const note = request.result[0]; store.put({ ...note, revision: note.revision + 1, bodyMd: "A different saved note from another tab.", updatedAt: "2026-04-24T05:01:00.000Z", deletedAt: removed ? "2026-04-24T05:01:00.000Z" : null }); }; tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close();
      }, state === "removed");
      // Native fixture writes bypass Dexie's cross-tab notifications. Exercise
      // the supported foreground refresh rather than inventing that signal.
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(page.getByRole("region", { name: "Verse note conflict" })).toBeVisible();
      await page.getByRole("region", { name: "Verse note conflict" }).scrollIntoViewIfNeeded();
    }
    if (state === "dialog") { await page.reload(); await page.getByRole("button", { name: "Add verse note", exact: true }).click(); await page.getByText("Kept drafts for this editor", { exact: true }).click(); await page.getByRole("button", { name: /Review kept draft/ }).click(); }
    if (state === "discard") await page.getByRole("button", { name: "Clear verse selection" }).click();
    if (state === "enlarged") await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(0,0); await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
    await settleReader(page); await expect(page).toHaveScreenshot(`notes-recovery-${state}.png`);
  });
}
