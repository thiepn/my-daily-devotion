import { expect, test, type Page } from "@playwright/test";
import { seedFocusedPrayer, sessionOrigin, sessionRoute } from "./focused-prayer-fixture";
import { seedPrayerJournal } from "./prayer-fixture";
import { writingSnapshot } from "./writing-fixture";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00")); });
const rows = (snapshot: unknown[], name: string): any[] => (snapshot.find((row: any) => row[0] === name) as any)[1];
async function changeRequest(page: Page, changes: Record<string, unknown>) {
  await page.evaluate(async changes => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("my-daily-devotion"); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction("prayers", "readwrite"), store = tx.objectStore("prayers"), r = store.get("detail-fixture");
    r.onsuccess = () => store.put({ ...r.result, ...changes, revision: r.result.revision + 1 });
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); db.close(); window.dispatchEvent(new Event("focus"));
  }, changes);
}

test("session disclosures, foreground refresh and answer opening are readonly", async ({ page }) => {
  await seedFocusedPrayer(page, { long: true }); const before = await writingSnapshot(page);
  await expect(page.locator(".session-heading-top")).toContainText("Request 1 of 3");
  await expect(page.locator(".session-reason")).toHaveText("Part of your saved session.");
  await page.getByRole("button", { name: "Read more", exact: true }).click(); await expect(page.getByRole("button", { name: "Read less", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.locator(".session-scripture summary").click(); await expect(page.locator(".journal-scripture blockquote")).toContainText("Devote yourselves to prayer");
  await page.getByText("Session options", { exact: true }).click();
  await page.getByRole("button", { name: "Mark answered", exact: true }).click();
  await expect(page.getByLabel("What happened?", { exact: false })).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  expect(await writingSnapshot(page)).toEqual(before);
});

test("Detail and Settings return to the saved request and originating control", async ({ page }) => {
  await seedFocusedPrayer(page); await page.getByRole("link", { name: "Open prayer", exact: true }).click();
  await page.getByRole("link", { name: "Edit details", exact: true }).click(); await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Add update", exact: true }).click(); await page.getByLabel("Prayer update").fill("A quiet encouragement from today.");
  await page.locator(".prayer-record-editor").getByRole("button", { name: "Add update", exact: true }).click();
  await expect(page.locator(".prayer-story-entry").first()).toContainText("A quiet encouragement from today.");
  await page.locator(".journal-heading .quiet-back-link").click();
  await expect(page).toHaveURL(new RegExp("#" + sessionRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
  await expect(page.locator(".session-latest")).toContainText("A quiet encouragement from today.");
  await expect(page.getByRole("link", { name: "Open prayer", exact: true })).toBeFocused();
  await page.getByRole("link", { name: "Pause and return" }).click(); expect(new URL(page.url()).hash).toBe("#" + sessionOrigin);
});

test("Scripture retains full ranges and browser Back restores the session", async ({ page }) => {
  await seedFocusedPrayer(page); const before = await writingSnapshot(page);
  await page.locator(".session-scripture summary").click(); await page.locator(".journal-scripture a").click();
  const query = new URLSearchParams(new URL(page.url()).hash.split("?")[1]);
  expect(query.get("start")).toBe("COL.4.2"); expect(query.get("end")).toBe("COL.4.3"); expect(query.get("return")).toBe(sessionRoute);
  // Deliberately allow Back before the lazy reader has finished rendering.
  await page.goBack(); await expect(page.locator(".session-heading-top")).toContainText("Request 1 of 3"); await expect(page.locator("#session-scripture-detail-link")).toBeFocused();
  const after = await writingSnapshot(page);
  for (const table of ["prayers", "prayerSessions", "prayerSessionItems", "activityEvents"]) expect(rows(after, table)).toEqual(rows(before, table));
});

test("Prayed, skip and finish record distinct explicit actions once", async ({ page }) => {
  await seedFocusedPrayer(page);
  await page.getByRole("button", { name: "Prayed · Next" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator(".session-request-text")).toHaveText("Wisdom for the decisions ahead."); await expect(page.locator("#session-request")).toBeFocused();
  await page.getByRole("button", { name: "Skip this request" }).click(); await expect(page.locator(".session-heading-top")).toContainText("Request 3 of 3");
  await page.getByRole("button", { name: "Prayed · Finish" }).click(); await expect(page.getByRole("heading", { name: "Session finished" })).toBeVisible();
  const snapshot = await writingSnapshot(page);
  expect(rows(snapshot, "activityEvents").filter(event => event.type === "PRAYER_PRAYED")).toHaveLength(2);
  expect(rows(snapshot, "prayerSessionItems").map(item => item.outcome)).toEqual(["NEXT", "SKIP", "NEXT"]);
  expect(rows(snapshot, "prayers").find(prayer => prayer.id === "focus-prayer-1").lastPrayedAt).toBeNull();
  await page.reload(); await expect(page.getByRole("heading", { name: "Session finished" })).toBeVisible(); expect(await writingSnapshot(page)).toEqual(snapshot);
});

test("unfinished answers block skipping and navigation without recording", async ({ page }) => {
  await seedFocusedPrayer(page); const before = await writingSnapshot(page);
  await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("Not ready to record.");
  await page.getByRole("button", { name: "Skip this request" }).click(); await expect(page.getByRole("dialog")).toContainText("has not been recorded");
  await expect(page.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused(); await page.keyboard.press("Escape");
  await expect(page.getByLabel("What happened?", { exact: false })).toHaveValue("Not ready to record.");
  await page.getByRole("link", { name: "Open prayer", exact: true }).click(); await page.getByRole("button", { name: "Discard and continue" }).click();
  await expect(page.locator(".prayer-request")).toBeVisible(); expect(await writingSnapshot(page)).toEqual(before);
  await page.goBack(); await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await expect(page.getByLabel("What happened?", { exact: false })).toHaveValue("");
});

test("failed answers retain writing and retry commits one resolution", async ({ page }) => {
  await seedFocusedPrayer(page); await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("Provision and peace.");
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; let fail = true; IDBObjectStore.prototype.put = function (...args) { if (this.name === "prayerResolutions" && fail) { fail = false; throw new DOMException("Storage temporarily unavailable", "QuotaExceededError"); } return put.apply(this, args); }; });
  await page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true }).click(); await expect(page.locator(".journal-status")).toContainText("Storage temporarily unavailable"); await expect(page.getByLabel("What happened?", { exact: false })).toHaveValue("Provision and peace.");
  await page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
  const snapshot = await writingSnapshot(page); expect(rows(snapshot, "prayerResolutions")).toHaveLength(1); expect(rows(snapshot, "activityEvents").filter(event => event.type === "PRAYER_ANSWERED")).toHaveLength(1);
  expect(rows(snapshot, "activityEvents").filter(event => event.type === "PRAYER_PRAYED")).toHaveLength(0);
});

test("ending confirms remaining requests and ended URLs never start another session", async ({ page }) => {
  await seedFocusedPrayer(page); await openRoute(page, "/prayer/session?session=focus-session&return=%2Ftoday"); await page.getByText("Session options", { exact: true }).click(); await page.getByRole("button", { name: "End session", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("will not be marked prayed"); await expect(page.getByRole("button", { name: "Keep praying" })).toBeFocused();
  await page.getByRole("dialog").getByRole("button", { name: "End session", exact: true }).click(); await expect(page.getByRole("heading", { name: "Session ended", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to Prayer", exact: true })).toHaveAttribute("href", "#/prayer"); await expect(page.getByRole("link", { name: "Back", exact: true })).toHaveAttribute("href", "#/today");
  const snapshot = await writingSnapshot(page); expect(rows(snapshot, "prayerSessionItems").every(item => item.outcome === null)).toBe(true); expect(rows(snapshot, "activityEvents")).toHaveLength(0);
  await page.reload(); await expect(page.getByRole("heading", { name: "Session ended", exact: true })).toBeVisible(); expect(await writingSnapshot(page)).toEqual(snapshot);
});

test("identified sessions keep date and order across midnight and reload", async ({ page }) => {
  await seedFocusedPrayer(page); await page.clock.setFixedTime(new Date("2026-04-25T00:01:00+02:00")); await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".session-date-notice")).toContainText("April 24, 2026"); await page.reload(); await expect(page.locator(".session-heading-top")).toContainText("Request 1 of 3");
  await page.getByRole("button", { name: "Prayed · Next" }).click(); await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
  const snapshot = await writingSnapshot(page); expect(rows(snapshot, "activityEvents")[0].localDate).toBe("2026-04-24");
  await page.getByRole("link", { name: "Start today’s session" }).click(); await expect(page.locator(".session-date-notice")).toHaveCount(0);
  const after = await writingSnapshot(page); expect(rows(after, "prayerSessions")).toHaveLength(2); expect(rows(after, "prayerSessions").find(session => session.id === "focus-session").endedAt).not.toBeNull(); expect(rows(after, "prayerSessions").find(session => session.id !== "focus-session").localDate).toBe("2026-04-25");
});

test("invalid, missing and deleted session URLs never create records", async ({ page }) => {
  await seedFocusedPrayer(page); const before = await writingSnapshot(page);
  for (const id of ["missing", "!invalid", ""]) { await openRoute(page, "/prayer/session?session=" + encodeURIComponent(id)); await expect(page.getByRole("heading", { name: "Session unavailable" })).toBeVisible(); expect(await writingSnapshot(page)).toEqual(before); }
  await page.evaluate(async () => { const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("my-daily-devotion"); r.onsuccess = () => resolve(r.result); }); const tx = db.transaction("prayerSessions", "readwrite"), store = tx.objectStore("prayerSessions"), r = store.get("focus-session"); r.onsuccess = () => store.put({ ...r.result, deletedAt: "2026-04-24T06:00:00.000Z", revision: 2 }); await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); }); db.close(); });
  const removed = await writingSnapshot(page); await openRoute(page, sessionRoute); await expect(page.getByRole("heading", { name: "Session unavailable" })).toBeVisible(); expect(await writingSnapshot(page)).toEqual(removed);
});

test("changed or deleted requests keep answer writing until explicit continuation", async ({ page }) => {
  await seedFocusedPrayer(page); await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("Keep this note.");
  await changeRequest(page, { deletedAt: "2026-04-24T06:00:00.000Z" });
  await expect(page.getByLabel("Unsaved answer note")).toHaveValue("Keep this note."); await expect(page.locator(".session-request-text")).toHaveCount(0);
  const before = await writingSnapshot(page); await page.evaluate(() => window.dispatchEvent(new Event("focus"))); expect(await writingSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Continue session", exact: true }).click(); await page.getByRole("button", { name: "Discard and continue" }).click();
  await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3"); const after = await writingSnapshot(page);
  expect(rows(after, "prayerSessionItems")[0].outcome).toBe("SKIP"); expect(rows(after, "prayerResolutions")).toHaveLength(0); expect(rows(after, "activityEvents")).toHaveLength(0);
});

test("concurrent wording changes require review before answering", async ({ page, context }) => {
  await seedFocusedPrayer(page); await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("My answer note.");
  const other = await context.newPage(); await openRoute(other, "/prayer/detail-fixture"); await other.getByRole("button", { name: "Edit wording", exact: true }).click(); await other.getByLabel("Request", { exact: true }).fill("Updated by another person on this device."); await other.getByRole("button", { name: "Save wording", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review the changed request" })).toBeVisible(); await expect(page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Use saved request" }).click(); await expect(page.getByLabel("What happened?", { exact: false })).toHaveValue("My answer note."); await page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true }).click(); await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
});

test("optional Scripture failure leaves explicit prayer actions usable", async ({ page }) => {
  await page.route("**/bible/books/COL.json", route => route.abort()); await seedFocusedPrayer(page); await page.locator(".session-scripture summary").click(); await expect(page.getByRole("button", { name: "Retry Scripture" })).toBeVisible();
  await page.unroute("**/bible/books/COL.json"); await page.getByRole("button", { name: "Retry Scripture" }).click(); await expect(page.locator(".journal-scripture blockquote")).toContainText("Devote yourselves to prayer");
  await page.getByRole("button", { name: "Prayed · Next" }).click(); await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
});

test("Today and filtered Prayer launch canonical URLs and retain the origin", async ({ page }) => {
  await seedFocusedPrayer(page); await openRoute(page, "/today"); await page.getByRole("link", { name: "Pray — Resume session", exact: true }).click();
  let query = new URLSearchParams(new URL(page.url()).hash.split("?")[1]); expect(query.get("session")).toBe("focus-session"); expect(query.get("return")).toBe("/today");
  await openRoute(page, sessionOrigin); await page.getByRole("link", { name: "Resume prayer", exact: true }).click();
  query = new URLSearchParams(new URL(page.url()).hash.split("?")[1]); expect(query.get("session")).toBe("focus-session"); expect(query.get("return")).toContain("person=detail-person");
});

test("manual-only requests remain outside automatic sessions", async ({ page }) => {
  await seedPrayerJournal(page, { manual: true }); const before = await writingSnapshot(page); await openRoute(page, "/prayer/session?depth=quick");
  await expect(page.getByRole("heading", { name: "A moment for prayer" })).toBeVisible(); expect(await writingSnapshot(page)).toEqual(before);
});

test("mobile layout, keyboard dialogs, enlarged text and dark contrast", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seedFocusedPrayer(page);
  const action = page.getByRole("button", { name: "Prayed · Next" }); const box = await action.boundingBox(); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await expect(page.locator(".mobile-nav")).toBeHidden(); await expectNoAxeViolations(page);
  const targets = await page.locator(".session-journal").locator("button, a, summary").evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({ label: node.textContent, height: node.getBoundingClientRect().height })));
  for (const target of targets) expect(target.height, target.label ?? "Session control").toBeGreaterThanOrEqual(44);
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const name of ["Prayed · Next", "Mark answered"]) { await page.getByRole("button", { name, exact: true }).hover(); await expectNoAxeViolations(page); }
  }
  await page.mouse.move(0, 0); await page.emulateMedia({ colorScheme: "light" });
  for (const width of [320,360,390,430,768,1440]) { await page.setViewportSize({ width, height: 900 }); await expectNoHorizontalOverflow(page); }
  await page.setViewportSize({ width: 320, height: 844 }); await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
  await page.emulateMedia({ colorScheme: "dark" }); await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await expect(page.getByLabel("What happened?", { exact: false })).toBeFocused();
  await page.getByRole("link", { name: "Pause and return" }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await expectNoAxeViolations(page); await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const action of ["prayed", "skip", "answer", "end"]) test(`committed ${action} survives a failed refresh without repeating`, async ({ page }) => {
  await seedFocusedPrayer(page);
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get, put = IDBObjectStore.prototype.put;
    let fail = false;
    IDBObjectStore.prototype.get = function (...args) { if (fail && this.name === "prayerSessions" && this.transaction.mode === "readonly") throw new Error("Refresh unavailable"); return get.apply(this, args); };
    IDBObjectStore.prototype.put = function (...args) { if (["prayerSessions", "prayerSessionItems"].includes(this.name)) this.transaction.addEventListener("complete", () => { fail = true; }); return put.apply(this, args); };
    (window as any).restoreSessionRead = () => { fail = false; IDBObjectStore.prototype.get = get; IDBObjectStore.prototype.put = put; };
  });
  if (action === "prayed") await page.getByRole("button", { name: "Prayed · Next" }).click();
  if (action === "skip") await page.getByRole("button", { name: "Skip this request" }).click();
  if (action === "answer") { await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true }).click(); }
  if (action === "end") { await page.getByText("Session options", { exact: true }).click(); await page.getByRole("button", { name: "End session", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "End session", exact: true }).click(); }
  await expect(page.getByRole("button", { name: "Retry refresh", exact: true })).toBeVisible();
  if (action === "end") await expect(page.getByRole("heading", { name: "Session ended", exact: true })).toBeVisible();
  else await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
  await page.evaluate(() => (window as any).restoreSessionRead()); const saved = await writingSnapshot(page);
  await page.getByRole("button", { name: "Retry refresh", exact: true }).click(); await expect(page.getByRole("button", { name: "Retry refresh", exact: true })).toHaveCount(0);
  expect(await writingSnapshot(page)).toEqual(saved); expect(rows(saved, "activityEvents")).toHaveLength(action === "prayed" || action === "answer" ? 1 : 0);
});

test("simultaneous tab actions cannot record the same pending request twice", async ({ page, context }) => {
  await seedFocusedPrayer(page); const other = await context.newPage(); await openRoute(other, sessionRoute); await expect(other.locator(".session-heading-top")).toContainText("Request 1 of 3");
  await holdSessionWrites(page);
  // Capture both controls before either tab can react to the other commit.
  await Promise.all([page, other].map(tab => tab.getByRole("button", { name: "Prayed · Next" }).evaluate((button: HTMLButtonElement) => button.click())));
  await page.evaluate(() => { (window as any).releaseSessionLock = true; });
  await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3"); await expect(other.locator(".session-heading-top")).toContainText("Request 2 of 3");
  expect(rows(await writingSnapshot(page), "activityEvents").filter(event => event.type === "PRAYER_PRAYED")).toHaveLength(1);
});

async function holdSessionWrites(page: Page) {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("my-daily-devotion"); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction("prayers", "readwrite"); (window as any).releaseSessionLock = false;
    const keep = () => { const r = tx.objectStore("prayers").get("detail-fixture"); r.onsuccess = () => { if (!(window as any).releaseSessionLock) keep(); }; }; keep(); tx.oncomplete = () => db.close();
  });
}
test("answer commitment locks the field and blocks navigation until settled", async ({ page }) => {
  await seedFocusedPrayer(page); await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("A recorded answer.");
  await holdSessionWrites(page);
  await page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true }).click(); await expect(page.getByLabel("What happened?", { exact: false })).toBeDisabled();
  await page.getByRole("link", { name: "Pause and return" }).click(); await expect(page.getByRole("dialog")).toContainText("Recording your action");
  await page.evaluate(() => { (window as any).releaseSessionLock = true; }); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
  expect(rows(await writingSnapshot(page), "prayerResolutions")).toHaveLength(1);
});

test("optional person and update failures retain the request and retry independently", async ({ page }) => {
  await seedFocusedPrayer(page);
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get, cursor = IDBIndex.prototype.openCursor;
    IDBObjectStore.prototype.get = function (...args) { if (this.name === "people") throw new Error("Person unavailable"); return get.apply(this, args); };
    IDBIndex.prototype.openCursor = function (...args) { if (this.objectStore.name === "prayerUpdates") throw new Error("Context unavailable"); return cursor.apply(this, args); };
    (window as any).restoreOptionalContext = () => { IDBObjectStore.prototype.get = get; IDBIndex.prototype.openCursor = cursor; };
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByRole("button", { name: "Retry person", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Retry context", exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Prayed · Next" })).toBeEnabled();
  await page.evaluate(() => (window as any).restoreOptionalContext()); const before = await writingSnapshot(page);
  await page.getByRole("button", { name: "Retry person", exact: true }).click(); await page.getByRole("button", { name: "Retry context", exact: true }).click(); await expect(page.getByRole("button", { name: /^Retry (person|context)$/ })).toHaveCount(0); expect(await writingSnapshot(page)).toEqual(before);
});

test("late input after answer commitment stays copyable and cannot create another resolution", async ({ page }) => {
  await seedFocusedPrayer(page); await page.getByRole("button", { name: "Mark answered", exact: true }).click(); await page.getByLabel("What happened?", { exact: false }).fill("The submitted answer.");
  await holdSessionWrites(page); await page.locator(".session-answer").getByRole("button", { name: "Mark answered", exact: true }).click(); await expect(page.getByLabel("What happened?", { exact: false })).toBeDisabled();
  // Model a queued composition/input event; normal typing is disabled during commit.
  await page.getByLabel("What happened?", { exact: false }).evaluate((input: HTMLTextAreaElement) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "The submitted answer. Newer writing."); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.evaluate(() => { (window as any).releaseSessionLock = true; });
  await expect(page.getByLabel("Unsaved answer note")).toHaveValue("The submitted answer. Newer writing."); await expect(page.getByRole("button", { name: "Mark answered", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue session", exact: true }).click(); await expect(page.getByRole("dialog")).toContainText("The answer is already recorded"); await page.getByRole("button", { name: "Keep note", exact: true }).click(); await expect(page.getByLabel("Unsaved answer note")).toBeVisible();
  await page.getByRole("button", { name: "Continue session", exact: true }).click(); await page.getByRole("button", { name: "Discard and continue" }).click(); await expect(page.locator(".session-heading-top")).toContainText("Request 2 of 3");
  const saved = rows(await writingSnapshot(page), "prayerResolutions"); expect(saved).toHaveLength(1); expect(saved[0].reflectionMd).toBe("The submitted answer.");
});

test("late session reads cannot replace a different session route", async ({ page, context }) => {
  await seedFocusedPrayer(page); await openRoute(page, "/today");
  const other = await context.newPage(); await openRoute(other, "/today"); await holdSessionWrites(other);
  await page.evaluate(route => { location.hash = route; }, sessionRoute); await expect(page.getByText("Opening your saved session…", { exact: true })).toBeVisible();
  await page.evaluate(() => { location.hash = "/prayer/session?session=missing"; }); await other.evaluate(() => { (window as any).releaseSessionLock = true; });
  await expect(page.getByRole("heading", { name: "Session unavailable" })).toBeVisible(); await expect(page.locator(".session-request-text")).toHaveCount(0);
});
