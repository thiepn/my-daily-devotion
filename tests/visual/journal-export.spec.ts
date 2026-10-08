import { expect, test } from '@playwright/test';
import { seedHistoryJournal } from '../ux/history-fixture';
import { openRoute } from '../ux/helpers';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
for (const width of [320,360,390,430,768,1440]) test(`Journal export ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await seedHistoryJournal(page); await openRoute(page, '/history/export?from=2026-04-19&to=2026-04-24');
  await expect(page.locator('.journal-export-entry')).toHaveCount(5); await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`journal-export-${width}.png`, { fullPage: true });
});
for (const state of ['dark','text200','print','empty','invalid']) test(`Journal export ${state}`, async ({ page }) => {
  await page.setViewportSize({ width: state === 'text200' ? 320 : 390, height: 844 }); if (state === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
  await seedHistoryJournal(page, { long: state === 'print' }); await openRoute(page, `/history/export?from=${state === 'invalid' ? '2026-02-29' : '2026-04-19'}&to=2026-04-24${state === 'empty' ? '&sections=' : ''}`);
  if (state !== 'invalid') await expect(page.locator('.journal-export-preview')).toBeVisible();
  if (state === 'text200') await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  if (state === 'print') await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready); await expect(page).toHaveScreenshot(`journal-export-${state}.png`, { fullPage: true });
});
