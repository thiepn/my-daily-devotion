import { expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

/** Synthetic, deterministic records for browser evidence only; never shipped in the app. */
export async function seedPrayerJournal(page: Page, options: { count?: number; session?: boolean; long?: boolean; manual?: boolean } = {}) {
  await openRoute(page, '/prayer');
  const count = options.count ?? 5;
  await page.evaluate(async ({ count, session, long, manual }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('my-daily-devotion'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const stores = ['prayers', 'people', 'categories', 'prayerSchedules', 'prayerSessions', 'prayerSessionItems'];
    const tx = database.transaction(stores, 'readwrite');
    const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
    const fields = (id: string, index = 0) => ({ id, createdAt: `2026-04-20T08:${String(index).padStart(2, '0')}:00.000Z`, updatedAt: `2026-04-24T06:${String(59-index).padStart(2, '0')}:00.000Z`, revision: 1, deletedAt: null });
    const names = ['Anna', 'Daniel', 'Our community', 'Miriam', 'Parents'];
    const bodies = ['Peace and wisdom for the week ahead.', 'Strength through treatment and recovery.', 'Kindness, unity, and faithfulness together.', 'Courage and patience in a new season.', 'Health and daily encouragement.'];
    for (let i = 0; i < 5; i++) tx.objectStore('people').put({ ...fields(`person-${i}`), name: names[i], relationship: null, notes: null });
    tx.objectStore('categories').put({ ...fields('family'), name: 'Family', sortOrder: 0 });
    tx.objectStore('categories').put({ ...fields('community'), name: 'Community', sortOrder: 1 });
    if (manual) tx.objectStore('prayerSchedules').put({ ...fields('manual'), mode: 'MANUAL_ONLY', weekdays: [], intervalDays: null, monthlyDay: null, onDate: null, anchorDate: null });
    for (let i = 0; i < count; i++) tx.objectStore('prayers').put({ ...fields(`prayer-${i}`, i), body: (bodies[i % 5] + (i >= 5 ? ` Request ${i+1}.` : '')) + (long ? ' Please help us listen carefully, remain hopeful, and support one another through every uncertain day.'.repeat(8) : ''), status: 'ACTIVE', personId: `person-${i % 5}`, categoryId: i % 2 ? 'community' : 'family', scheduleId: manual ? 'manual' : null, eventDate: null, focusUntil: null, sourceReflectionId: null, sourceDevotionDate: null, lastPrayedAt: i === 1 ? '2026-04-23T06:00:00.000Z' : null, archivedAt: null });
    if (session) {
      tx.objectStore('prayerSessions').put({ ...fields('session'), localDate: '2026-04-24', startedAt: '2026-04-24T05:00:00.000Z', endedAt: null, depth: 'regular' });
      for (let i = 0; i < count; i++) tx.objectStore('prayerSessionItems').put({ ...fields(`item-${i}`), sessionId: 'session', prayerId: `prayer-${i}`, position: count - i, surfacedAt: '2026-04-24T05:00:00.000Z', outcome: null, actedAt: null });
    }
    await done; database.close();
  }, { count, ...options });
  await page.reload();
  await expect(page.locator('.prayer-journal-row')).toHaveCount(Math.min(5, count));
  await expect(page.locator('.prayer-quotation blockquote')).toBeVisible();
  await expect(page.locator('.prayer-focus-reason')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

export async function prayerDatabaseSnapshot(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('my-daily-devotion'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const stores = ['prayers', 'people', 'categories', 'prayerSchedules', 'prayerSessions', 'prayerSessionItems', 'prayerUpdates', 'prayerResolutions', 'activityEvents'];
    const tx = database.transaction(stores, 'readonly');
    const result = await Promise.all(stores.map(store => new Promise<unknown[]>((resolve, reject) => { const r = tx.objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); })));
    database.close(); return result;
  });
}
