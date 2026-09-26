import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-24T08:00:00+02:00'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

test('Bible journal retains artwork and readable Scripture across viewports', async ({ page }, info) => {
  for (const [width, height] of [[390, 844], [430, 932], [360, 800], [320, 568], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await openRoute(page, '/bible/LUK/9');
    await expect(page.getByRole('heading', { name: 'Luke 9', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const starts = await page.locator('.verse-number').evaluateAll(buttons => buttons.map(button => {
      const numeral = document.createRange();
      numeral.selectNodeContents(button);
      const firstLetter = document.createRange();
      const text = button.nextElementSibling!.firstChild!;
      firstLetter.setStart(text, 0);
      firstLetter.setEnd(text, 1);
      return { gap: firstLetter.getBoundingClientRect().left - numeral.getBoundingClientRect().right, sameLine: firstLetter.getBoundingClientRect().top < numeral.getBoundingClientRect().bottom, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height };
    }));
    for (const spacing of starts) {
      expect(spacing.gap).toBeGreaterThanOrEqual(0);
      expect(spacing.gap).toBeLessThanOrEqual(6);
      expect(spacing.width).toBeGreaterThanOrEqual(44);
      expect(spacing.height).toBeGreaterThanOrEqual(44);
      expect(spacing.sameLine).toBe(true);
    }
    await expect(page.locator('.mg-bible-chapter-art img')).toBeVisible();
    const art = await page.locator('.mg-bible-chapter-art').boundingBox();
    expect(art?.height).toBeGreaterThan(110);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`bible-${width}.png`), animations: 'disabled' });
  }
});

test('reader panels work with keyboard and remember appearance after reload', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/bible/LUK/9');
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await expect(page.getByLabel('Reading font')).toBeFocused();
  await page.getByLabel('Reading font').selectOption('sans');
  await page.getByLabel('Scripture text size').fill('140');
  await page.getByLabel('Line spacing').selectOption('generous');
  await expectNoAxeViolations(page);
  await page.screenshot({ path: info.outputPath('bible-appearance.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Reading appearance', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.locator('.grace-bible')).toHaveAttribute('data-reading-font', 'sans');
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await expect(page.getByLabel('Scripture text size')).toHaveValue('140');
  await expect(page.getByLabel('Line spacing')).toHaveValue('generous');
  await page.getByRole('button', { name: 'Reset reading appearance' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Choose book and chapter' }).click();
  await expect(page.getByRole('combobox', { name: 'Book', exact: true })).toBeFocused();
  await page.getByRole('combobox', { name: 'Book', exact: true }).selectOption('PSA');
  await expect(page.getByRole('combobox', { name: 'Chapter', exact: true }).locator('option')).toHaveCount(150);
  await page.getByRole('combobox', { name: 'Chapter', exact: true }).selectOption('23');
  await page.screenshot({ path: info.outputPath('bible-passage-picker.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Open passage' }).click();
  await expect(page).toHaveURL(/bible\/PSA\/23/);
  await expect(page.getByRole('button', { name: 'Select Psalms 23:1', exact: true })).toBeVisible();
});

test('selection, note editor, and enlarged text remain usable on a narrow phone', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRoute(page, '/bible/LUK/9?verse=23');
  await page.getByRole('button', { name: 'Highlight', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove highlight' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.screenshot({ path: info.outputPath('bible-selection.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.getByRole('button', { name: 'Add verse note' }).click();
  await page.getByLabel('Verse note', { exact: true }).fill('Take up the cross daily.');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Verse note saved locally.');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.screenshot({ path: info.outputPath('bible-320-enlarged.png'), animations: 'disabled' });
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Clear verse selection' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Reading appearance', exact: true }).click();
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('bible-320-appearance-enlarged.png'), animations: 'disabled' });
});
