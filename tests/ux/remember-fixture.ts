import type { Page } from '@playwright/test';
import { seedHistoryJournal } from './history-fixture';
export async function seedAnniversaryHistory(page: Page) {
  await seedHistoryJournal(page);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open('my-daily-devotion'); request.onsuccess = () => resolve(request.result); });
    const tx = database.transaction(['reflections','activityEvents'], 'readwrite');
    const done = new Promise<void>((resolve,reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); });
    const reflection = tx.objectStore('reflections').get('00000000-0000-4000-8000-000000000704');
    reflection.onsuccess = () => tx.objectStore('reflections').put({ ...reflection.result, localDate: '2025-04-24' });
    const event = tx.objectStore('activityEvents').get('history-reflection-event');
    event.onsuccess = () => tx.objectStore('activityEvents').put({ ...event.result, localDate: '2025-04-24' });
    await done; database.close();
  });
}
