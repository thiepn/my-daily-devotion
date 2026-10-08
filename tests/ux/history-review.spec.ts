import { expect, test } from '@playwright/test';
import { seedHistoryJournal, historySnapshot } from './history-fixture';
import { openRoute, expectNoAxeViolations, expectNoHorizontalOverflow } from './helpers';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
test('weekly review defaults to the completed week and selected entries restore its full context', async ({ page }) => {
  await seedHistoryJournal(page); const before = await historySnapshot(page);
  await page.getByRole('link', { name: 'Weekly review', exact: true }).click();
  await expect(page.getByLabel('Week containing')).toHaveValue('2026-04-13');
  await expect(page.locator('.history-journal-row')).toHaveCount(1);
  await page.getByLabel('Week containing').fill('2026-04-24');
  await expect(page).toHaveURL(/week=2026-04-20/); await expect(page.locator('.history-journal-row')).toHaveCount(4);
  const origin = new URL(page.url()).hash;
  await page.locator('#history-row-history-reflection-event').click();
  await expect(page.locator('.history-day-entry.is-selected')).toBeFocused();
  await page.locator('#history-back').click();
  await expect.poll(() => new URL(page.url()).hash).toBe(origin);
  await expect(page.locator('#history-row-history-reflection-event')).toBeFocused();
  expect(await historySnapshot(page)).toEqual(before);
});
test('inclusive ranges expose all matching writing beyond 200 with truthful counts and zero writes', async ({ page }) => {
  await seedHistoryJournal(page, { count: 235 }); const before = await historySnapshot(page);
  await openRoute(page, '/history/range?from=2026-04-18&to=2026-04-19&shown=240&return=%2Fhistory%3Fperiod%3D2026');
  await expect(page.locator('.history-list-footer')).toContainText('Showing 231 of 231 entries');
  await expect(page.locator('.history-journal-row')).toHaveCount(231);
  await page.getByLabel('From', { exact: true }).fill('2026-04-20');
  await page.getByLabel('Through', { exact: true }).fill('2026-04-20');
  await page.getByRole('button', { name: 'Open this chapter' }).click();
  await expect(page.locator('.history-list-footer')).toContainText('Showing 1 of 1 entries');
  expect(await historySnapshot(page)).toEqual(before);
});
test('invalid ranges remain recoverable and invalid week parameters normalize without writing', async ({ page }) => {
  await seedHistoryJournal(page); const before = await historySnapshot(page);
  await openRoute(page, '/history/range?from=2026-02-29&to=2026-01-01');
  await expect(page.getByText('Choose the first and last date. Both dates are included.')).toBeVisible();
  await openRoute(page, '/history/review?week=bad&shown=-1');
  await expect(page).toHaveURL(/week=2026-04-13&shown=20/);
  await expect(page.locator('.history-list-footer')).toContainText('1 of 1');
  expect(await historySnapshot(page)).toEqual(before);
});
test('manual reviews retain dark contrast, keyboard access and enlarged mobile reflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await seedHistoryJournal(page); await openRoute(page, '/history/review?week=2026-04-20');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(page.locator('.history-list-footer')).toContainText('4 of 4');
  await expect(page.locator('.mobile-nav')).toBeVisible();
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
  for (const control of await page.locator('.history-review-controls button').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
