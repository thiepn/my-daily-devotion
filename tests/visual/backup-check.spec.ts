import { expect, test } from '@playwright/test';
import { dataSnapshot, downloadBackup, fixtureBackup, seedBackupData } from '../ux/data-fixture';
import { openRoute } from '../ux/helpers';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
for (const width of [320,360,390,430,768,1440]) test(`Backup check ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await openRoute(page, '/data/check'); await page.evaluate(() => document.fonts.ready); await expect(page).toHaveScreenshot(`backup-check-${width}.png`, { fullPage: true });
});
test('Backup check encrypted password form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seedBackupData(page);
  const bytes = await downloadBackup(page, 'a-long-password'); await openRoute(page, '/data/check');
  await expect(page.locator('.backup-check-screen')).toBeVisible();
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: 'encrypted-journal.mddbackup', mimeType: 'application/zip', buffer: bytes });
  await expect(page.getByLabel('Backup password', { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready); await expect(page).toHaveScreenshot('backup-check-encrypted.png', { fullPage: true });
});
for (const state of ['dark','text200','selected','result','error']) test(`Backup check ${state}`, async ({ page }) => {
  await page.setViewportSize({ width: state === 'text200' ? 320 : 390, height: 844 }); if (state === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
  await seedBackupData(page); const bytes = fixtureBackup(await dataSnapshot(page)); await openRoute(page, '/data/check');
  if (state !== 'dark') { await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: state === 'text200' ? 'My-personal-journal-with-a-long-filename.mddbackup' : 'my-journal.mddbackup', mimeType: 'application/zip', buffer: state === 'error' ? Buffer.from('bad archive') : bytes }); await expect(page.getByText('my-journal.mddbackup', { exact: true }).or(page.getByText('My-personal-journal-with-a-long-filename.mddbackup', { exact: true }))).toBeVisible(); }
  if (state === 'text200') await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  if (state === 'result') { await page.getByRole('button', { name: 'Validate this backup' }).click(); await expect(page.getByRole('heading', { name: 'What this file contains' })).toBeVisible(); }
  if (state === 'error') await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => document.fonts.ready); await expect(page).toHaveScreenshot(`backup-check-${state}.png`, { fullPage: true });
});
