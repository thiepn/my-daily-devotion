import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

for (const theme of ['light', 'dark'] as const) {
  test(`Data controls retain readable labels in ${theme} mode`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, '/data');
    await page.getByRole('button', { name: `${theme === 'light' ? 'Light' : 'Dark'} theme` }).click();
    const backup = page.getByRole('button', { name: 'Download plain backup', exact: true });
    await backup.scrollIntoViewIfNeeded();
    // axe can classify same-color text as invisible. Check this recovered control directly.
    const contrast = await backup.evaluate(element => {
      const style = getComputedStyle(element);
      const luminance = (color: string) => {
        const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722;
      };
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await backup.focus();
    await expect(backup).toBeFocused();
    await expect(page.getByRole('button', { name: 'Download encrypted backup' })).toBeDisabled();
    await expectNoAxeViolations(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: info.outputPath(`data-controls-${theme}.png`), animations: 'disabled' });
  });

  test(`Shared secondary controls remain usable in ${theme} mode at narrow widths`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    const surfaces = [
      ['/search', '.global-search-form', 'search'],
      ['/prayer/new', 'textarea', 'new-prayer'],
      ['/today/reflection/2026-04-24', '.reflection-textarea', 'reflection'],
      ['/bible/collections', '.collection-sidebar', 'collections'],
    ];
    for (const [route, ready, name] of surfaces) {
      await page.setViewportSize({ width: 390, height: 844 });
      await openRoute(page, route!);
      await expect(page.locator(ready!).first()).toBeVisible();
      await expectNoAxeViolations(page);
      await page.screenshot({ path: info.outputPath(`${name}-${theme}-390.png`), animations: 'disabled' });
      await page.setViewportSize({ width: 320, height: 720 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await expectNoHorizontalOverflow(page);
      await expectNoAxeViolations(page);
      await page.screenshot({ path: info.outputPath(`${name}-${theme}-320-text200.png`), animations: 'disabled', fullPage: true });
    }
  });
}
