import { expect, test } from "@playwright/test";
import { openRoute, expectNoAxeViolations } from "./helpers";
import { seedWriting, writingSnapshot, writingDomainSnapshot } from "./writing-fixture";

const field = "What do you want to pray about?";
test("newer input during commitment remains copyable and cannot replay prayer creation", async ({ page }) => {
  await openRoute(page, "/prayer/new"); await page.getByLabel(field).fill("Submitted request.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction("prayers", "readwrite"); (window as any).releaseCaptureLock = false;
    const keep = () => { const request = tx.objectStore("prayers").get("unused"); request.onsuccess = () => { if (!(window as any).releaseCaptureLock) keep(); }; }; keep(); tx.oncomplete = () => db.close();
  });
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.locator(".save-state")).toHaveText("Saving…");
  await page.getByLabel(field).evaluate((node: HTMLTextAreaElement) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, "Submitted request. Newer queued writing."); node.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.evaluate(() => { (window as any).releaseCaptureLock = true; });
  await expect(page.locator(".journal-status")).toContainText("Copy your newer writing");
  await expect(page.getByLabel(field)).toHaveValue("Submitted request. Newer queued writing.");
  await expect(page.getByRole("button", { name: "Save prayer", exact: true })).toBeDisabled();
  await expect(page.locator(".draft-status")).toContainText("Action already recorded");
  const rows = Object.fromEntries(await writingSnapshot(page) as any);
  expect(rows.prayers).toHaveLength(1); expect(rows.prayers[0].body).toBe("Submitted request."); expect(rows.activityEvents).toHaveLength(1);
  expect(rows.editorDraftContents[0].payload.body).toBe("Submitted request. Newer queued writing.");
});
async function recover(page: import("@playwright/test").Page) {
  await page.getByText("Kept drafts for this editor", { exact: true }).click();
  await page.getByRole("button", { name: /Review kept draft/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Review kept writing" })).toBeVisible();
  await page.getByRole("button", { name: "Recover for review" }).click();
}
test("pristine capture and disclosures remain entirely write-free", async ({ page }) => {
  await openRoute(page, "/prayer/new"); const before = await writingSnapshot(page);
  await page.getByRole("button", { name: "Add details", exact: true }).click();
  await page.getByRole("button", { name: "Hide details", exact: true }).click();
  await page.getByLabel(field).focus();
  expect(await writingSnapshot(page)).toEqual(before);
});
test("capture reload recovery keeps hidden incomplete details, full ranges, frozen date and return context", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-04-24T23:59:00+02:00"));
  const destination = "/prayer?status=WAITING&shown=15";
  await openRoute(page, "/prayer/new?translation=BSB&start=JHN.3.16&end=JHN.3.18&sourceDevotionDate=2026-04-24&return=" + encodeURIComponent(destination));
  const before = await writingDomainSnapshot(page);
  await page.getByLabel(field).fill("A prayer interrupted before saving.");
  await page.getByRole("button", { name: "Add details", exact: true }).click();
  await page.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("INTERVAL_DAYS");
  await page.getByLabel("Every", { exact: true }).fill("");
  await page.getByRole("button", { name: "Hide details", exact: true }).click();
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.clock.setFixedTime(new Date("2026-04-25T00:01:00+02:00"));
  await page.reload(); await expect(page.getByLabel(field)).toBeEmpty();
  await recover(page); await expect(page.getByLabel(field)).toHaveValue("A prayer interrupted before saving.");
  await page.getByRole("button", { name: "Add details", exact: true }).click();
  await expect(page.getByLabel("Every", { exact: true })).toBeEmpty();
  expect(await writingDomainSnapshot(page)).toEqual(before);
  await page.getByLabel("Every", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.locator(".prayer-request-text")).toHaveText("A prayer interrupted before saving.");
  const data = await writingSnapshot(page), rows = Object.fromEntries(data as any);
  expect(rows.prayers).toHaveLength(1); expect(rows.prayers[0]).toMatchObject({ sourceDevotionDate: "2026-04-24" });
  expect(rows.scriptureLinks[0]).toMatchObject({ startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.18" });
  expect(rows.prayerSchedules[0]).toMatchObject({ mode: "INTERVAL_DAYS", intervalDays: 4 });
  expect(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("return")).toBe(destination);
  expect(rows.activityEvents.filter((row: any) => row.type === "PRAYER_CREATED")).toHaveLength(1);
});
test("a failed private checkpoint permits one explicit standalone save", async ({ page }) => {
  await openRoute(page, "/prayer/new");
  await page.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === "editorDraftContents") throw new DOMException("Draft storage unavailable", "QuotaExceededError"); return original.apply(this, args); }; });
  await page.getByLabel(field).fill("Save once despite unavailable recovery storage.");
  await expect(page.getByRole("alert")).toContainText("Draft could not be kept");
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.locator(".prayer-request-text")).toHaveText("Save once despite unavailable recovery storage.");
  const rows = Object.fromEntries(await writingSnapshot(page) as any);
  expect(rows.prayers).toHaveLength(1); expect(rows.prayers[0].sourceDevotionDate).toBeNull(); expect(rows.activityEvents).toHaveLength(1);
});
test("a changed reflection requires explicit review after capture recovery", async ({ page }) => {
  await seedWriting(page, "prayer");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.evaluate(async () => { const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); }); const tx = db.transaction("reflections", "readwrite"), table = tx.objectStore("reflections"), request = table.get("00000000-0000-4000-8000-000000000701"); request.onsuccess = () => table.put({ ...request.result, revision: 2, bodyMd: "Changed saved source" }); await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close(); });
  await page.reload(); await recover(page);
  await expect(page.getByRole("button", { name: "Use reviewed reflection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save prayer", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Use reviewed reflection" }).click();
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.locator(".prayer-request-text")).toHaveText("Give me patience and wisdom in the conversations ahead.");
  expect(Object.fromEntries(await writingSnapshot(page) as any).prayers).toHaveLength(1);
});
test("Recovery routes a prayer draft to explicit review without automatic creation", async ({ page }) => {
  await openRoute(page, "/prayer/new"); await page.getByLabel(field).fill("Recover through Your data.");
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  const before = await writingDomainSnapshot(page);
  await page.reload(); await openRoute(page, "/recovery");
  await page.getByRole("link", { name: /New prayer/ }).click();
  await page.getByRole("link", { name: "Review in Add prayer" }).click();
  await expect(page.getByRole("dialog", { name: "Review kept writing" })).toBeVisible();
  await expect(page.getByLabel(field)).toBeEmpty(); await expectNoAxeViolations(page);
  expect(await writingDomainSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Recover for review" }).click();
  await expect(page.getByLabel(field)).toHaveValue("Recover through Your data.");
  expect(await writingDomainSnapshot(page)).toEqual(before);
});
