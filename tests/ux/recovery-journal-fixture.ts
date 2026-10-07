import { expect, type Page } from "@playwright/test";
import { seedWriting, writingBody } from "./writing-fixture";
export const keptWriting = "The unfinished reflection belongs only in recovery until I explicitly save it.";
export async function seedRecovery(page: Page, count = 1) {
  await seedWriting(page, "reflection");
  await page.getByLabel("Daily reflection").fill(keptWriting);
  await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.reload(); await expect(page.getByLabel("Daily reflection")).toHaveValue(writingBody);
  const id = await page.evaluate(async count => {
    const connection = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const transaction = connection.transaction(["editorDrafts", "editorDraftContents"], "readwrite");
    const done = new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    const request = transaction.objectStore("editorDrafts").getAll();
    const metadata = await new Promise<any>(resolve => { request.onsuccess = () => resolve(request.result.find((row: any) => row.state === "active")); });
    const contentsRequest = transaction.objectStore("editorDraftContents").get(metadata.id);
    const contents = await new Promise<any>(resolve => { contentsRequest.onsuccess = () => resolve(contentsRequest.result); });
    for (let index = 1; index < count; index++) {
      const nextId = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      transaction.objectStore("editorDrafts").put({ ...metadata, id: nextId });
      transaction.objectStore("editorDraftContents").put({ ...contents, id: nextId });
    }
    await done; connection.close(); return metadata.id as string;
  }, count);
  return id;
}

