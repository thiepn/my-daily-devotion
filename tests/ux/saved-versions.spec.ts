import { test, expect } from "@playwright/test";
import { openRoute, expectNoAxeViolations } from "./helpers";

async function records(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("my-daily-devotion");
    return new Promise<Record<string, unknown[]>>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, names = ["reflections", "activityEvents", "savedVersions", "savedVersionContents", "removalGroups"], transaction = db.transaction(names), result: Record<string, unknown[]> = {};
        for (const name of names) { const read = transaction.objectStore(name).getAll(); read.onsuccess = () => { result[name] = read.result; }; }
        transaction.oncomplete = () => { db.close(); resolve(result); }; transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    });
  });
}
test("explicit reflection edits capture prior writing and readonly Recovery leaves it unchanged", async ({ page }) => {
  await openRoute(page, "/today/reflection/2024-02-29"); const editor = page.getByRole("textbox", { name: "Daily reflection" });
  await editor.fill("Original saved writing."); await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible(); expect((await records(page)).savedVersions).toHaveLength(0);
  await editor.fill("Revised saved writing."); await page.getByRole("button", { name: "Save reflection", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  const saved = await records(page); expect(saved.savedVersions).toHaveLength(1); expect(saved.savedVersionContents).toEqual([expect.objectContaining({ writing: { kind: "reflection", bodyMd: "Original saved writing.", localDate: "2024-02-29" } })]);
  expect(saved.reflections).toEqual([expect.objectContaining({ bodyMd: "Revised saved writing.", revision: 2, localDate: "2024-02-29" })]); expect(saved.activityEvents).toHaveLength(1);
  await openRoute(page, "/recovery?return=%2Fdata"); await expect(page.getByRole("heading", { name: "Recovery", exact: true })).toBeVisible();
  expect(await records(page)).toEqual(saved); await expectNoAxeViolations(page);
});
test("the additive migration reports physical schema 3 while ordinary backup remains format 1", async ({ page }) => {
  await openRoute(page, "/data?section=advanced"); await expect(page.getByText(/Local database schema 3 · Backup format 1/)).toBeVisible();
  const result = await records(page); expect(result.savedVersions).toHaveLength(0); expect(result.removalGroups).toHaveLength(0);
});
