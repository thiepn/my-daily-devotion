import { expect, test } from "@playwright/test";
import { seedFocusedPrayer } from "../ux/focused-prayer-fixture";
import { openRoute } from "../ux/helpers";
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });
for (const [width, height] of [[320,568], [360,800], [390,844], [430,932], [768,1024], [1440,900]]) test("Focused Prayer " + width, async ({ page }) => {
  await page.setViewportSize({ width, height }); await seedFocusedPrayer(page);
  await page.mouse.move(0, 0); await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`focused-prayer-${width}.png`);
});
for (const state of ["dark", "enlarged", "long", "context", "answer", "confirmation", "end-confirmation", "finished", "ended", "previous-day", "unavailable", "failure", "empty", "changed"]) test("Focused Prayer " + state, async ({ page }) => {
  await page.setViewportSize({ width: state === "enlarged" ? 320 : 390, height: 844 });
  if (state === "dark") await page.emulateMedia({ colorScheme: "dark" });
  await seedFocusedPrayer(page, { long: state === "long", ...(state === "finished" || state === "ended" ? { closed: state } : {}), date: state === "previous-day" ? "2026-04-23" : "2026-04-24" });
  if (state === "enlarged") await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  if (state === "context") { await page.locator(".session-scripture summary").click(); await expect(page.locator(".journal-scripture blockquote")).toContainText("Devote yourselves to prayer"); }
  if (["answer", "confirmation", "changed"].includes(state)) { await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("A quiet way forward opened. Thankful for peace and provision."); }
  if (state === "confirmation") { await page.getByRole("link", { name: "Pause and return" }).click(); await expect(page.getByRole("dialog")).toBeVisible(); }
  if (state === "end-confirmation") { await page.getByText("Session options", { exact: true }).click(); await page.getByRole("button", { name: "End session", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); }
  if (state === "unavailable") { await openRoute(page, "/prayer/session?session=missing"); await expect(page.getByRole("heading", { name: "Session unavailable" })).toBeVisible(); }
  if (state === "failure") { await page.addInitScript(() => { const get = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (...args) { if (this.name === "prayerSessions") throw new Error("Read unavailable"); return get.apply(this, args); }; }); await page.reload(); await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible(); }
  if (state === "empty") { await page.evaluate(async () => { const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("my-daily-devotion"); r.onsuccess = () => resolve(r.result); }); const tx = db.transaction(["prayers", "prayerSessions", "prayerSessionItems"], "readwrite"); for (const store of ["prayers", "prayerSessions", "prayerSessionItems"]) tx.objectStore(store).clear(); await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); db.close(); }); await openRoute(page, "/prayer/session?depth=quick"); await expect(page.getByRole("heading", { name: "A moment for prayer" })).toBeVisible(); }
  if (state === "changed") { await page.evaluate(async () => { const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("my-daily-devotion"); r.onsuccess = () => resolve(r.result); }); const tx = db.transaction("prayers", "readwrite"), store = tx.objectStore("prayers"), get = store.get("detail-fixture"); get.onsuccess = () => store.put({ ...get.result, status: "WAITING", revision: get.result.revision + 1 }); await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); db.close(); window.dispatchEvent(new Event("focus")); }); await expect(page.getByRole("heading", { name: "Your unsaved answer note" })).toBeVisible(); }
  await page.evaluate(() => document.fonts.ready); await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`focused-prayer-${state}.png`, { fullPage: !state.includes("confirmation") });
});
