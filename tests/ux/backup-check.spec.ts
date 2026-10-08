import { expect, test } from '@playwright/test';
import { dataSnapshot, downloadBackup, fixtureBackup, seedBackupData } from './data-fixture';
import { openRoute, expectNoAxeViolations, expectNoHorizontalOverflow } from './helpers';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
test('a backup check validates counts and returns to the originating Data context without writes', async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page), bytes = fixtureBackup(before);
  await openRoute(page, '/data?section=backups&return=%2Fhistory%3Fperiod%3D2025');
  await page.getByText('Check a backup', { exact: true }).click(); await page.getByRole('link', { name: 'Open backup check' }).click();
  await expect(page.locator('.backup-check-screen')).toBeVisible();
  const input = page.locator('.backup-check-screen').getByLabel('Backup file', { exact: true }); await input.setInputFiles({ name: 'my-journal.mddbackup', mimeType: 'application/zip', buffer: bytes });
  await expect(page.getByRole('status')).toContainText('not yet been validated');
  await page.getByRole('button', { name: 'Validate this backup' }).click();
  await expect(page.getByRole('status')).toContainText('Backup validated');
  await page.getByText('All records & deletion markers', { exact: true }).click();
  await expect(page.locator('.backup-full-counts').getByText('Prayers', { exact: true }).locator('..')).toContainText('2 saved · 1 removed');
  await expect(page.getByRole('button', { name: /Restore|Merge|Replace/ })).toHaveCount(0);
  expect(await dataSnapshot(page)).toEqual(before);
  await page.getByRole('link', { name: 'Back', exact: false }).first().click();
  await expect(page).toHaveURL(/#\/data\?section=backups&return=%2Fhistory%3Fperiod%3D2025$/);
  await expect(page.locator('#data-backup-check')).toBeFocused();
});
test('encrypted checks recover from wrong passwords and clear password/file state after success', async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page), bytes = await downloadBackup(page, 'a-long-password');
  await openRoute(page, '/data/check'); await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: 'encrypted.mddbackup', mimeType: 'application/zip', buffer: bytes });
  await page.getByLabel('Backup password', { exact: true }).fill('wrong'); await page.getByRole('button', { name: 'Validate this backup' }).click();
  await expect(page.getByRole('alert')).toContainText(/password/i); await page.getByLabel('Backup password', { exact: true }).fill('a-long-password');
  await page.getByRole('button', { name: 'Show password' }).click(); await expect(page.getByLabel('Backup password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Validate this backup' }).click(); await expect(page.getByRole('status')).toContainText('Backup validated');
  await expect(page.getByLabel('Backup password', { exact: true })).toHaveCount(0); await expect(page.getByLabel('Backup file', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Check another backup' }).click(); await expect(page.locator('.backup-full-counts')).toHaveCount(0);
  expect(await dataSnapshot(page)).toEqual(before);
});
test('corrupted archives cannot claim validation and cancellation leaves records unchanged', async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page);
  await openRoute(page, '/data/check'); await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: 'bad.mddbackup', mimeType: 'application/zip', buffer: Buffer.from('not a backup') });
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('heading', { name: 'What this file contains' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel check' }).click(); await expect(page.getByRole('alert')).toHaveCount(0); expect(await dataSnapshot(page)).toEqual(before);
});
test('backup checking supports dark narrow enlarged text and long filenames', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ colorScheme: 'dark' });
  await seedBackupData(page); const bytes = fixtureBackup(await dataSnapshot(page)); await openRoute(page, '/data/check');
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: 'A-very-long-personal-journal-filename-'.repeat(4) + '.mddbackup', mimeType: 'application/zip', buffer: bytes });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
  await expect(page.locator('.mobile-nav')).toBeVisible();
});

test('cancelled file reads cannot replace a later check or write journal records', async ({ page }) => {
  await seedBackupData(page); const before = await dataSnapshot(page), bytes = fixtureBackup(before);
  await openRoute(page, '/data/check'); await expect(page.locator('.backup-check-screen')).toBeVisible();
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    (window as unknown as { releaseBackupRead: () => void }).releaseBackupRead = () => {};
    File.prototype.arrayBuffer = async function () {
      if (this.name === 'slow.mddbackup') await new Promise<void>(resolve => { (window as unknown as { releaseBackupRead: () => void }).releaseBackupRead = resolve; });
      return original.call(this);
    };
  });
  const file = page.locator('.backup-check-screen').getByLabel('Backup file', { exact: true });
  await file.setInputFiles({ name: 'slow.mddbackup', mimeType: 'application/zip', buffer: bytes });
  await expect(page.getByRole('status')).toContainText('Reading the file');
  await page.getByRole('button', { name: 'Cancel check' }).click();
  await file.setInputFiles({ name: 'current.mddbackup', mimeType: 'application/zip', buffer: bytes });
  await expect(page.getByRole('status')).toContainText('not yet been validated');
  await page.evaluate(() => (window as unknown as { releaseBackupRead: () => void }).releaseBackupRead());
  await expect(page.getByText('current.mddbackup', { exact: true })).toBeVisible();
  await expect(page.getByText('slow.mddbackup', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Validate this backup' }).click();
  await expect(page.getByRole('status')).toContainText('Backup validated');
  expect(await dataSnapshot(page)).toEqual(before);
});
