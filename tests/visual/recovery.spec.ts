import { expect, test } from '@playwright/test';
import { seedRecovery } from '../ux/recovery-journal-fixture';
import { openRoute } from '../ux/helpers';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00')); });
for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1440,900]]) {
  test(`Recovery directory ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await seedRecovery(page, 25); await openRoute(page, '/recovery?return=%2Fdata');
    await expect(page.locator('.recovery-pagination')).toContainText('20 of 25 entries');
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(0,0);
    await expect(page).toHaveScreenshot(`recovery-directory-${width}.png`, { fullPage: true });
  });
}
for (const state of ['writing','dark','enlarged','empty','dialog','error']) {
  test(`Recovery ${state}`, async ({ page }) => {
    await page.setViewportSize({ width: state === 'enlarged' ? 320 : 390, height: 844 });
    if (state === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
    if (state === 'empty') { await openRoute(page, '/recovery'); await expect(page.getByRole('heading', { name: 'No unfinished writing here.' })).toBeVisible(); }
    else {
      const id = await seedRecovery(page); await openRoute(page, `/recovery/${id}?return=%2Fdata`);
      await expect(page.getByLabel('Your reflection')).toBeVisible();
      if (state === 'enlarged') await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      if (state === 'dialog') { await page.getByRole('button', { name: 'Discard this recovery entry' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); }
      if (state === 'error') {
        await page.evaluate(() => { const original = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function(...args) { if (this.name === 'editorDrafts') throw new DOMException('Recovery storage is unavailable.', 'UnknownError'); return original.apply(this,args); }; });
        await page.getByRole('link', { name: 'Back', exact: false }).first().click(); await page.locator('.recovery-directory a').first().click();
        await expect(page.getByRole('button', { name: 'Retry recovery' })).toBeVisible();
      }
    }
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(0,0);
    await expect(page).toHaveScreenshot(`recovery-${state}.png`, { fullPage: true });
  });
}
