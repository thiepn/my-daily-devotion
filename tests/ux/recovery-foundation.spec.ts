import { expect, test } from "@playwright/test";
import { holdLegacyDatabase } from "./recovery-fixture";
import { openRoute, expectNoHorizontalOverflow, expectNoAxeViolations } from "./helpers";

test("blocked v1 upgrade explains recovery and continues after the legacy tab closes", async ({ context, page }, testInfo) => {
  await holdLegacyDatabase(page);
  const next = await context.newPage();
  await next.goto("/#/today");
  await expect(next.getByRole("heading", { name: "Finish writing in the other tab" })).toBeVisible();
  await expect(next.getByRole("button", { name: "Retry opening MDD" })).toBeVisible();
  await expectNoHorizontalOverflow(next); await expectNoAxeViolations(next);
  await next.screenshot({ path: testInfo.outputPath("blocked-upgrade.png"), fullPage: true, animations: "disabled" });
  await page.evaluate(() => (window as unknown as { heldLegacy: IDBDatabase }).heldLegacy.close());
  await expect(next.locator(".today-journal")).toBeVisible();
  const metadata = await next.evaluate(async () => {
    const request = indexedDB.open("my-daily-devotion");
    return new Promise(resolve => {
      request.onsuccess = () => {
        const connection = request.result, transaction = connection.transaction(["schemaMetadata", "draftJournalState"]);
        const version = transaction.objectStore("schemaMetadata").get("database"), journal = transaction.objectStore("draftJournalState").get("journal");
        transaction.oncomplete = () => { resolve({ version: version.result, journal: journal.result }); connection.close(); };
      };
    });
  });
  expect(metadata).toMatchObject({ version: { schemaVersion: 3, contractVersion: 1 }, journal: { formatVersion: 1 } });
});

test("a storage upgrade closes the old connection without replacing unsaved writing", async ({ page }, testInfo) => {
  await openRoute(page, "/today/reflection/2026-10-07");
  const writing = page.getByRole("textbox", { name: "Daily reflection" });
  await writing.fill("Keep this unsaved writing in memory while another tab updates storage.");
  await page.evaluate(async () => {
    const request = indexedDB.open("my-daily-devotion", 40);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("syntheticFutureStore", { keyPath: "id" });
      request.transaction!.objectStore("schemaMetadata").put({ key: "database", schemaVersion: 4, contractVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-10-07T00:00:00.000Z" });
    };
    await new Promise<void>((resolve, reject) => { request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error); });
  });
  await expect(page.getByText("Another tab updated local storage.")).toBeVisible();
  await expect(writing).toHaveValue("Keep this unsaved writing in memory while another tab updates storage.");
  await expect(page.getByRole("button", { name: "Reload when ready" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("writing-during-upgrade.png"), fullPage: true, animations: "disabled" });
});

test("service-worker activation waits while writing is protected", async ({ page }) => {
  await openRoute(page, "/today/reflection/2026-10-07");
  await page.getByRole("textbox", { name: "Daily reflection" }).fill("Unsaved reflection");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:update-ready", { detail: { waiting: null } })));
  const update = page.getByRole("button", { name: "Reload to update" });
  await expect(update).toBeDisabled();
  await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await expect(update).toBeEnabled();
});
