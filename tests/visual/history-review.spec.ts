import { expect, test } from '@playwright/test';
import { seedHistoryJournal } from '../ux/history-fixture';
import { openRoute } from '../ux/helpers';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
for (const screen of ['review', 'range']) for (const width of [320, 360, 390, 430, 768, 1440]) test(`History ${screen} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 }); await seedHistoryJournal(page);
  await openRoute(page, screen === 'review' ? '/history/review?week=2026-04-20' : '/history/range?from=2026-04-20&to=2026-04-24');
  await expect(page.locator('.history-list-footer')).toContainText('4 of 4');
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`history-${screen}-${width}.png`, { fullPage: true });
});
for (const state of ['dark', 'text200', 'empty', 'invalid']) test(`History review ${state}`, async ({ page }) => {
  await page.setViewportSize({ width: state === 'text200' ? 320 : 390, height: 844 });
  if (state === 'dark') await page.emulateMedia({ colorScheme: 'dark' }); await seedHistoryJournal(page);
  await openRoute(page, state === 'invalid' ? '/history/range?from=bad&to=2026-04-20' : `/history/review?week=${state === 'empty' ? '2025-01-01' : '2026-04-20'}`);
  if (state === 'text200') await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  if (state !== 'invalid') await expect(page.locator('.history-list-footer')).toBeVisible();
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`history-review-${state}.png`, { fullPage: true });
});
