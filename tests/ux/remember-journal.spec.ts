import { expect,test } from '@playwright/test';
import { openRoute, expectNoAxeViolations, expectNoHorizontalOverflow } from './helpers';
import { dataSnapshot } from './data-fixture';
import { seedAnniversaryHistory } from './remember-fixture';
const key = 'mdd-remember-choices-v1';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
test('suggestions require opt-in, dismissal lasts today, and reading returns preserve source context without domain writes', async ({ page }) => {
  await seedAnniversaryHistory(page); const before = await dataSnapshot(page);
  await openRoute(page, '/history'); await expect(page.locator('.remember-suggestions')).toHaveCount(0);
  await openRoute(page, '/data?section=privacy&return=%2Fhistory%3Fperiod%3Dall');
  await page.getByRole('button', { name: 'Enable On this day', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Choices saved' })).toBeVisible();
  await openRoute(page, '/history?period=all'); await page.getByRole('link', { name: 'Revisit these moments' }).click();
  await expect(page.locator('.history-journal-row')).toHaveCount(1); await page.locator('.history-journal-row').click();
  await expect(page.locator('.history-day-entry.is-selected')).toBeFocused(); await page.locator('#history-back').click(); await expect(page).toHaveURL(/on-this-day/);
  await openRoute(page, '/history?period=all'); await page.getByRole('button', { name: 'Dismiss for today' }).click(); await expect(page.locator('.remember-suggestions')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.remember-suggestions')).toHaveCount(0);
  await openRoute(page, '/data?section=privacy'); await page.getByRole('button', { name: 'Turn off On this day' }).click();
  expect(await dataSnapshot(page)).toEqual(before);
});
test('monthly reminders defer on activation and receipt generation and can be postponed or disabled', async ({ page }) => {
  await seedAnniversaryHistory(page); const before = await dataSnapshot(page);
  await openRoute(page, '/data?section=privacy'); await page.getByRole('button', { name: 'Enable monthly backup reminders' }).click();
  await expect(page.getByText('Next reminder no earlier than 2026-05-24', { exact: false })).toBeVisible();
  await openRoute(page, '/history'); await expect(page.getByRole('heading', { name: 'Keep a separate copy' })).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-05-24T07:00:00+02:00')); await page.reload();
  await expect(page.getByRole('heading', { name: 'Keep a separate copy' })).toBeVisible();
  await expect(page.getByText('You may already have a backup elsewhere', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Remind me next month' }).click(); await expect(page.getByRole('heading', { name: 'Keep a separate copy' })).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2026-06-24T07:00:00+02:00'));
  await page.evaluate(() => localStorage.setItem('mdd-backup-receipt-v1', JSON.stringify({ version: 1, generatedAt: '2026-06-23T07:00:00Z', kind: 'encrypted' }))); await page.reload();
  await expect(page.getByRole('heading', { name: 'Keep a separate copy' })).toHaveCount(0);
  await openRoute(page, '/data?section=privacy'); await page.getByRole('button', { name: 'Turn off backup reminders' }).click();
  expect(await dataSnapshot(page)).toEqual(before);
});
test('unavailable preference persistence never claims opt-in or changes journal records', async ({ page }) => {
  await seedAnniversaryHistory(page); const before = await dataSnapshot(page);
  await page.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key,value) { if (key === 'mdd-remember-choices-v1') throw new DOMException('Test storage failure','QuotaExceededError'); return original.call(this,key,value); }; });
  await openRoute(page, '/data?section=privacy'); await page.reload(); await page.getByRole('button', { name: 'Enable On this day', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Could not save');
  await expect(page.getByRole('button', { name: 'Enable On this day', exact: true })).toBeVisible(); expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  expect(await dataSnapshot(page)).toEqual(before);
});
test('enabled anniversary reading retains keyboard contrast and enlarged narrow reflow', async ({ page }) => {
  await page.setViewportSize({ width:320,height:844 }); await page.emulateMedia({ colorScheme:'dark' }); await seedAnniversaryHistory(page);
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({version:1,anniversaries:true,dismissedDates:[],backupReminder:null})), key);
  await openRoute(page, '/history/on-this-day?return=%2Fhistory%3Fperiod%3Dall'); await expect(page.locator('.history-journal-row')).toHaveCount(1);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page); await expect(page.locator('.mobile-nav')).toBeVisible();
});
