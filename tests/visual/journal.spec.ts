import { expect, test } from '@playwright/test';
import { enrollCalendarPlan, openRoute } from '../ux/helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));
});

for (const [width, height] of [[320, 568], [360, 800], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
  for (const screen of ['today', 'bible']) {
    test(`${screen} light ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      if (screen === 'today') await enrollCalendarPlan(page);
      else await openRoute(page, '/bible/LUK/9');
      await expect(page.locator(screen === 'today' ? '.today-verse blockquote' : '.scripture-copy')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page).toHaveScreenshot(`${screen}-light-${width}.png`);
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`Data backup controls ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, '/data');
    await page.getByRole('button', { name: `${theme === 'light' ? 'Light' : 'Dark'} theme`, exact: true }).click();
    const panel = page.locator('.data-panel').filter({ has: page.getByRole('button', { name: 'Download plain backup', exact: true }) });
    await page.evaluate(() => document.fonts.ready);
    await expect(panel).toHaveScreenshot(`data-backup-${theme}.png`);
  });
}

for (const theme of ['light', 'dark'] as const) test(`Bible highlighted passage and dock in ${theme} mode`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: theme });
  await openRoute(page, '/bible/LUK/9?verse=23');
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Highlighted locally.');
  // Anchor this comparison after fonts and the status-bearing dock finish layout.
  // The initial route scroll may precede either; behavioral tests cover that handoff.
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Select Luke 9:23', exact: true }).evaluate(async element => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await expect(page).toHaveScreenshot(`bible-${theme}-highlight.png`);
});

test('Bible enlarged reading controls at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openRoute(page, '/bible/LUK/9');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await expect(page).toHaveScreenshot('bible-320-text200-controls.png');
});

test('Bible asset failure remains recoverable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/bible/books/LUK.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await openRoute(page, '/bible/LUK/9');
  await expect(page.locator('.bible-error')).toBeVisible();
  await expect(page).toHaveScreenshot('bible-error.png');
});
