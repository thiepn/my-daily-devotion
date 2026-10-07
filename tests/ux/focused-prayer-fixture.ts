import { expect, type Page } from "@playwright/test";
import { seedPrayerDetail } from "./prayer-detail-fixture";
import { openRoute } from "./helpers";

export const sessionOrigin = "/prayer?status=ACTIVE&person=00000000-0000-4000-8000-000000008002";
export const sessionRoute = "/prayer/session?session=00000000-0000-4000-8000-000000009001&return=" + encodeURIComponent(sessionOrigin);
export async function seedFocusedPrayer(page: Page, options: { long?: boolean; closed?: "finished" | "ended"; date?: string; count?: number } = {}) {
  await seedPrayerDetail(page, { count: 1, long: options.long ?? false });
  await page.evaluate(async ({ date, closed, count }) => {
    const db = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const tx = db.transaction(["prayers", "prayerSessions", "prayerSessionItems"], "readwrite");
    const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    const base = { createdAt: "2026-04-24T05:00:00.000Z", updatedAt: "2026-04-24T05:00:00.000Z", revision: 1, deletedAt: null };
    tx.objectStore("prayerSessions").put({ ...base, id: "00000000-0000-4000-8000-000000009001", localDate: date, startedAt: base.createdAt, depth: "quick", endedAt: closed ? "2026-04-24T05:10:00.000Z" : null });
    for (let index = 0; index < count; index++) {
      const prayerId = index === 0 ? "00000000-0000-4000-8000-000000008001" : `00000000-0000-4000-8000-${String(9200+index).padStart(12,"0")}`;
      if (index) tx.objectStore("prayers").put({ ...base, id: prayerId, body: index === 1 ? "Wisdom for the decisions ahead." : "Patience and hope for our family.", status: "ACTIVE", personId: null, categoryId: null, scheduleId: null, eventDate: null, focusUntil: null, sourceReflectionId: null, sourceDevotionDate: null, lastPrayedAt: null, archivedAt: null });
      tx.objectStore("prayerSessionItems").put({ ...base, id: `00000000-0000-4000-8000-${String(9300+index).padStart(12,"0")}`, sessionId: "00000000-0000-4000-8000-000000009001", prayerId, position: index, surfacedAt: base.createdAt, outcome: closed === "finished" ? "NEXT" : null, actedAt: closed === "finished" ? "2026-04-24T05:10:00.000Z" : null });
    }
    await done; db.close();
  }, { date: options.date ?? "2026-04-24", closed: options.closed ?? null, count: options.count ?? 3 });
  await openRoute(page, sessionRoute);
  await expect(page.locator(options.closed ? ".session-state" : ".session-request-text")).toBeVisible();
  if (!options.closed) await expect(page.locator(".prayer-record-person")).toContainText("Anna Wilson");
  await page.evaluate(() => document.fonts.ready);
}
