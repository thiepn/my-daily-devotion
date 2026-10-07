import type { Page } from "@playwright/test";
import { schemaV1 } from "../../src/data/schema";
export async function holdLegacyDatabase(page: Page) {
  await page.goto("/THIRD_PARTY_NOTICES.txt");
  await page.evaluate(async schema => {
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("my-daily-devotion", 10);
      request.onupgradeneeded = () => {
        for (const [name, definition] of Object.entries(schema)) {
          const [primary, ...indexes] = definition.split(",");
          const table = request.result.createObjectStore(name, { keyPath: primary!.replace(/^&/, "") });
          for (const index of indexes) {
            const indexName = index.replace(/^&/, "");
            table.createIndex(indexName, indexName.startsWith("[") ? indexName.slice(1, -1).split("+") : indexName, { unique: index.startsWith("&") });
          }
        }
        request.transaction!.objectStore("schemaMetadata").put({ key: "database", schemaVersion: 1, contractVersion: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    connection.onversionchange = () => undefined; // Simulate a legacy tab that cannot close itself.
    (window as unknown as { heldLegacy: IDBDatabase }).heldLegacy = connection;
  }, schemaV1);
}

