import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";
import { writingDomainSnapshot, writingSnapshot } from "./writing-fixture";

import { keptWriting, seedRecovery } from "./recovery-journal-fixture";
test("Recovery directory paginates without private excerpts or database writes and restores focus", async ({ page }) => {
  await seedRecovery(page, 55); const before = await writingSnapshot(page);
  await openRoute(page, "/recovery?return=%2Fdata");
  await expect(page.locator(".recovery-pagination")).toContainText("20 of 55 entries");
  await expect(page.locator(".recovery-directory")).not.toContainText(keptWriting);
  await page.getByRole("link", { name: "Show more", exact: true }).click();
  await expect(page.locator(".recovery-pagination")).toContainText("40 of 55 entries");
  const first = page.locator(".recovery-directory a").first(), firstId = await first.getAttribute("id");
  await first.click(); await expect(page.getByRole("heading", { name: "Kept writing", exact: true })).toBeVisible();
  await expect(page.getByLabel("Your reflection")).toHaveValue(keptWriting);
  await page.goBack(); await expect(page.locator(".recovery-pagination")).toContainText("40 of 55 entries");
  await expect(page.locator(`#${firstId}`)).toBeFocused();
  await page.getByRole("link", { name: "Show more", exact: true }).click();
  await expect(page.locator(".recovery-pagination")).toContainText("55 of 55 entries");
  expect(await writingSnapshot(page)).toEqual(before);
});

test("review is readonly and recovering explicitly forks before a single domain save", async ({ page }) => {
  const id = await seedRecovery(page), before = await writingSnapshot(page);
  await openRoute(page, `/recovery/${id}?return=%2Fdata`);
  await page.getByRole("link", { name: "Review in Reflect", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Review kept reflection" })).toBeVisible();
  expect(await writingSnapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Recover for review", exact: true }).click();
  await expect(page.getByLabel("Daily reflection")).toHaveValue(keptWriting);
  expect(await writingDomainSnapshot(page)).toEqual(before.filter((row: any) => !["editorDrafts", "editorDraftContents", "draftJournalState"].includes(row[0])));
  await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.locator(".journal-status")).toContainText("saved locally");
  const snapshot: any = await writingSnapshot(page);
  expect(snapshot.find((row: any) => row[0] === "reflections")[1]).toEqual([expect.objectContaining({ bodyMd: keptWriting, revision: 2 })]);
  expect(snapshot.find((row: any) => row[0] === "activityEvents")[1]).toHaveLength(0);
});

test("discard is explicit and changes only its expected recovery generation", async ({ page }) => {
  const id = await seedRecovery(page), domain = await writingDomainSnapshot(page);
  await openRoute(page, `/recovery/${id}?return=%2Fdata`);
  await page.getByRole("button", { name: "Discard this recovery entry" }).click();
  await expect(page.getByRole("dialog", { name: "Discard kept writing?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep writing", exact: true })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Discard kept writing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No unfinished writing here." })).toBeVisible();
  expect(await writingDomainSnapshot(page)).toEqual(domain);
  const snapshot: any = await writingSnapshot(page);
  expect(snapshot.find((row: any) => row[0] === "editorDraftContents")[1]).toHaveLength(0);
  expect(snapshot.find((row: any) => row[0] === "editorDrafts")[1][0]).toMatchObject({ id, state: "discarded" });
});

test("previous-journal writing remains copyable without attaching it", async ({ page }) => {
  const id = await seedRecovery(page);
  await page.evaluate(async () => {
    const connection = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const transaction = connection.transaction("draftJournalState", "readwrite");
    transaction.objectStore("draftJournalState").put({ key: "journal", formatVersion: 1, epoch: crypto.randomUUID() });
    await new Promise<void>(resolve => { transaction.oncomplete = () => resolve(); }); connection.close();
  });
  const before = await writingSnapshot(page);
  await openRoute(page, `/recovery/${id}`);
  await expect(page.getByText("This writing belongs to a previous local journal.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review in Reflect" })).toHaveCount(0);
  await page.getByRole("button", { name: "Select your reflection to copy" }).click();
  await expect(page.getByLabel("Your reflection")).toBeFocused();
  expect(await writingSnapshot(page)).toEqual(before);
});

test("empty recovery and long kept writing support dark, enlarged text and keyboard access", async ({ page }) => {
  await openRoute(page, "/data");
  await page.getByRole("link", { name: "Review unfinished writing on this device", exact: false }).click();
  await expect(page.getByRole("heading", { name: "No unfinished writing here." })).toBeVisible();
  const id = await seedRecovery(page);
  await openRoute(page, `/recovery/${id}`); await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
});

test("a failed refresh retains open writing and retries without domain writes", async ({ page }) => {
  const id = await seedRecovery(page), domain = await writingDomainSnapshot(page);
  await openRoute(page, `/recovery/${id}`); await expect(page.getByLabel("Your reflection")).toHaveValue(keptWriting);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    (window as any).restoreRecoveryGet = () => { IDBObjectStore.prototype.get = original; };
    IDBObjectStore.prototype.get = function (...args) { if (this.name === "editorDrafts") throw new DOMException("Recovery is unavailable.", "UnknownError"); return original.apply(this, args); };
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page.getByRole("button", { name: "Retry recovery" })).toBeVisible();
  await expect(page.getByLabel("Your reflection")).toHaveValue(keptWriting);
  await page.evaluate(() => (window as any).restoreRecoveryGet());
  await page.getByRole("button", { name: "Retry recovery" }).click();
  await expect(page.getByRole("button", { name: "Retry recovery" })).toHaveCount(0);
  expect(await writingDomainSnapshot(page)).toEqual(domain);
});

test("a stale discard confirmation preserves a newer kept generation", async ({ page }) => {
  const id = await seedRecovery(page);
  await openRoute(page, `/recovery/${id}`); await page.getByRole("button", { name: "Discard this recovery entry" }).click();
  await page.evaluate(async id => {
    const connection = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const transaction = connection.transaction(["editorDrafts", "editorDraftContents"], "readwrite");
    for (const table of ["editorDrafts", "editorDraftContents"]) {
      const request = transaction.objectStore(table).get(id);
      request.onsuccess = () => { const row = request.result; row.generation++; if (row.payload) row.payload.bodyMd = "Newer kept writing"; transaction.objectStore(table).put(row); };
    }
    await new Promise<void>(resolve => { transaction.oncomplete = () => resolve(); }); connection.close();
    window.dispatchEvent(new Event("focus"));
  }, id);
  await expect(page.getByLabel("Your reflection")).toHaveValue("Newer kept writing");
  await page.getByRole("button", { name: "Discard kept writing", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("This draft changed before discard.");
  await expect(page.getByLabel("Your reflection")).toHaveValue("Newer kept writing");
});
