import { expect, test } from '@playwright/test';
import { seedPrayerJournal } from '../ux/prayer-fixture';
import { openRoute } from '../ux/helpers';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) test(`Prayer journal light ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height }); await seedPrayerJournal(page);
  await expect(page).toHaveScreenshot(`prayer-light-${width}.png`);
});
for (const state of ['dark','empty','long','filters','session','enlarged']) test(`Prayer journal ${state}`, async ({ page }) => {
  await page.setViewportSize({ width: state === 'enlarged' ? 320 : 390, height: 844 });
  if (state === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
  if (state === 'enlarged') await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '200%'; }));
  if (state === 'empty') { await openRoute(page, '/prayer'); await expect(page.locator('.prayer-journal-empty')).toBeVisible(); await expect(page.locator('.prayer-quotation blockquote')).toBeVisible(); }
  else await seedPrayerJournal(page, { long: state === 'long', session: state === 'session' });
  if (state === 'filters') await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`prayer-${state}.png`, { fullPage: state === 'enlarged' || state === 'filters' });
});

test('Prayer error has a composed recovery state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seedPrayerJournal(page);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.openCursor;
    IDBObjectStore.prototype.openCursor = function(...args) { if (this.name === 'people') throw new DOMException('Test read failure', 'UnknownError'); return original.apply(this, args); };
  });
  await page.reload(); await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.prayer-quotation blockquote')).toBeVisible();
  await expect(page.locator('.prayer-focus-reason')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('prayer-error.png');
});
