import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { openRoute } from "./helpers";

export async function dataSnapshot(page: Page): Promise<Record<string, unknown[]>> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const names = [...database.objectStoreNames].filter(name => name !== "schemaMetadata");
    const tx = database.transaction(names, "readonly"), result: Record<string, unknown[]> = {};
    await Promise.all(names.map(name => new Promise<void>((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => { result[name] = request.result; resolve(); }; request.onerror = () => reject(request.error); })));
    database.close(); return result;
  });
}
export async function seedBackupData(page: Page) {
  await openRoute(page, "/data");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const tx = database.transaction(["prayers", "activityEvents"], "readwrite");
    const date = "2026-04-24T05:00:00.000Z";
    for (let i = 0; i < 3; i++) {
      tx.objectStore("prayers").put({ id: "backup-prayer-" + i, createdAt: date, updatedAt: date, revision: i === 2 ? 2 : 1, deletedAt: i === 2 ? date : null, body: ["Wisdom and patience for today.", "Peace for our family.", "Retained removed writing."][i], status: "ACTIVE", personId: null, categoryId: null, scheduleId: null, eventDate: null, focusUntil: null, sourceReflectionId: null, sourceDevotionDate: null, lastPrayedAt: null, archivedAt: null });
      tx.objectStore("activityEvents").put({ id: "backup-event-" + i, type: "PRAYER_CREATED", localDate: "2026-04-24", occurredAt: date, timeZone: "Europe/Berlin", subjectType: "prayer", subjectId: "backup-prayer-" + i, metadata: {} });
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); database.close();
  });
}
export function fixtureBackup(data: Record<string, unknown[]>, changes: Record<string, unknown> = {}) {
  const payload = strToU8(JSON.stringify(data));
  return Buffer.from(zipSync({ "data.json": payload, "manifest.json": strToU8(JSON.stringify({ format: "mdd-backup", formatVersion: 1, appVersion: "0.8.0", schemaVersion: 1, exportedAt: "2026-04-24T05:00:00.000Z", files: [{ path: "data.json", bytes: payload.byteLength, sha256: createHash("sha256").update(payload).digest("hex") }], encryption: null, ...changes })) }));
}
export async function chooseBackup(page: Page, buffer: Buffer, name = "my-devotional-journal.mddbackup") {
  await page.getByLabel("Backup file", { exact: true }).setInputFiles({ name, mimeType: "application/zip", buffer });
  await expect(page.locator(".data-filename")).toHaveText(name);
}
export async function reviewBackup(page: Page, buffer: Buffer, mode: "merge" | "replace" = "merge") {
  await chooseBackup(page, buffer);
  await page.getByRole("radio", { name: new RegExp("^" + (mode === "merge" ? "Merge" : "Replace")) }).check();
  await page.getByRole("button", { name: "Preview & validate", exact: true }).click();
  await expect(page.locator(".backup-validated")).toBeVisible();
}
export async function downloadBackup(page: Page, password?: string) {
  if (password) {
    await page.getByRole("button", { name: "Create encrypted backup", exact: true }).click();
    await page.getByLabel("Encrypted backup password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
  } else await page.getByText("Other export options", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: password ? "Download encrypted backup" : "Download plain backup", exact: true }).click();
  const file = await pending; return readFile((await file.path())!);
}
