import { expect, type Page } from "@playwright/test";
import { openRoute } from "./helpers";
export async function seedMetadata(page: Page, kind: "people" | "categories" = "people", options: { count?: number; prayers?: number; long?: boolean } = {}) {
  await openRoute(page, "/today");
  await page.evaluate(async ({ count, prayers, long }) => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("my-daily-devotion"); r.onsuccess = () => resolve(r.result); });
    const tx = db.transaction(["people", "categories", "prayers"], "readwrite");
    const base = { createdAt: "2026-04-24T05:00:00.000Z", updatedAt: "2026-04-24T05:00:00.000Z", revision: 1, deletedAt: null };
    const names = ["Anna Wilson", "Daniel Kim", "My Church", "Parents", "The Wilson Family"];
    const categories = ["Personal", "Family", "Friends", "Church", "Mission"];
    for (let i = 0; i < count; i++) {
      tx.objectStore("people").put({ ...base, id: "person-" + i, name: long && i === 0 ? "Anna Elizabeth Wilson-Richardson and family" : names[i] ?? "Person " + String(i).padStart(3, "0"), relationship: ["Friend", "Neighbour", null, "Family", "Friends"][i % 5], notes: i === 0 ? long ? "Remember the people who have walked beside us.\n\n".repeat(12) : "A faithful friend from our church.\nRemember her family in prayer." : null });
      tx.objectStore("categories").put({ ...base, id: "category-" + i, name: long && i === 0 ? "Personal growth, family and everyday encouragement" : categories[i] ?? "Category " + i, sortOrder: i });
    }
    for (let i = 0; i < prayers; i++) tx.objectStore("prayers").put({ ...base, id: "metadata-prayer-" + i, updatedAt: new Date(Date.UTC(2026, 3, 24, 5, 0, prayers - i)).toISOString(), body: ["Peace and wisdom for the week ahead.", "Rest, healing and hope for our family.", "Thank You for the kindness we received.", "Patience in every conversation."][i % 4], status: ["ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"][i % 4], personId: "person-0", categoryId: "category-0", scheduleId: null, sourceReflectionId: null, sourceDevotionDate: null, eventDate: null, focusUntil: null, lastPrayedAt: null, archivedAt: null });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { count: options.count ?? 5, prayers: options.prayers ?? 8, long: options.long ?? false });
  await openRoute(page, "/prayer/" + kind);
  await expect(page.locator(".directory-row").first()).toBeVisible();
  await expect(page.locator(".directory-row").first()).not.toContainText("unavailable");
  await page.evaluate(() => document.fonts.ready);
}
export async function selectMetadata(page: Page, name: string) {
  const row = page.locator(".directory-row").filter({ has: page.locator(".directory-row-copy strong", { hasText: name }) });
  if (await row.locator(".directory-row-toggle").getAttribute("aria-expanded") !== "true") await row.locator(".directory-row-toggle").click();
  return row;
}
export async function editMetadata(page: Page, name: string, kind = "person") {
  const row = await selectMetadata(page, name);
  await row.getByRole("button", { name: "Edit " + kind, exact: true }).click();
}
