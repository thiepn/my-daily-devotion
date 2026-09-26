import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { enrollCalendarPlan, expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

test('Today reference composition, responsive artwork and deterministic captures', async ({ page }, info) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enrollCalendarPlan(page);
  const output = process.env.MDD_VISUAL_DIR ?? 'verification/morning-grace-v2';
  await mkdir(output, { recursive: true });
  for (const [width, height] of [[390,844], [430,932], [360,800], [320,720], [1440,900]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.locator('.today-verse blockquote')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.grace-art img')).toBeVisible();
    expect(await page.locator('.grace-art img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expectNoHorizontalOverflow(page);
    const art = await page.locator('.grace-art').boundingBox();
    expect(art!.height).toBeGreaterThan(230);
    await page.screenshot({ path: `${output}/today-${width}-${info.project.name}.png`, animations: 'disabled', fullPage: true });
    if (width === 390) {
      const cta = await page.locator(".today-devotion").boundingBox();
      const nav = await page.locator(".mobile-nav").boundingBox();
      expect(cta!.y + cta!.height).toBeLessThanOrEqual(nav!.y);
      await expectNoAxeViolations(page);
    }
  }
  await page.setViewportSize({ width: 320, height: 720 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expectNoHorizontalOverflow(page);
  await expect(page.locator('.today-devotion')).toBeVisible();
  await page.screenshot({ path: `${output}/today-320-text200-${info.project.name}.png`, animations: 'disabled', fullPage: true });
  await expectNoAxeViolations(page);
  await page.locator('.today-devotion').focus();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const enlargedButton = await page.locator('.today-devotion').boundingBox();
  const enlargedNav = await page.locator('.mobile-nav').boundingBox();
  expect(enlargedButton!.y + enlargedButton!.height).toBeLessThanOrEqual(enlargedNav!.y);
  expect(errors).toEqual([]);
});

test('Today preserves explicit completion, real Scripture and devotional routes', async ({ page }) => {
  await enrollCalendarPlan(page);
  await expect(page.locator('.today-verse-reference')).toContainText('Psalms 35:1');
  await expect(page.locator('.today-verse blockquote')).toContainText('Contend with my opponents');
  await page.getByRole('link', { name: 'Begin Today’s Devotion' }).click();
  await expect(page.getByRole('button', { name: 'Mark reading complete', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Today' }).click();
  await page.locator('.today-plan-card summary').click();
  await expect(page.locator('.today-reading-check[aria-pressed="true"]')).toHaveCount(0);
  await page.locator('.today-reading-check').first().click();
  await expect(page.getByText('1 of 4', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 of 4', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reflect — Write reflection' }).click();
  await expect(page.getByLabel('Daily reflection')).toBeVisible();
  await openRoute(page, '/today');
  await page.getByRole('link', { name: 'Pray — Add prayer' }).click();
  await expect(page.getByLabel('What do you want to pray about?')).toBeVisible();
});

test('Today keyboard disclosure and targets remain accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enrollCalendarPlan(page);
  const summary = page.locator('.today-plan-card summary');
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.today-plan-card')).toHaveAttribute('open', '');
  for (const selector of ['.today-profile', '.today-devotion', '.today-response', '.today-reading-check', '.mobile-nav .nav-link']) {
    for (const target of await page.locator(selector).all()) {
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await expectNoAxeViolations(page);
});

test('Today keeps self-paced enrollment, complete-day and leap-day states', async ({ page }) => {
  await openRoute(page, '/today');
  await page.getByRole('button', { name: 'Start self-paced at Day 1' }).click();
  await expect(page.getByText('Day 1', { exact: true })).toBeVisible();
  await page.locator('.today-plan-card summary').click();
  for (let index = 0; index < 4; index++) {
    await page.locator('.today-reading-check').nth(index).click();
    if (index < 3) await expect(page.getByText(`${index + 1} of 4`, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Day 2', { exact: true })).toBeVisible();
  // A fresh origin context exercises the canonical calendar pause separately.
  const leap = await page.context().browser()!.newContext({ locale: 'en-US', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const leapPage = await leap.newPage();
  await leapPage.clock.setFixedTime(new Date('2028-02-29T07:00:00+01:00'));
  await leapPage.goto('http://127.0.0.1:4173/#/today');
  await leapPage.getByRole('button', { name: 'Follow today’s calendar' }).click();
  await expect(leapPage.getByText('Leap-day pause', { exact: true })).toBeVisible();
  await expect(leapPage.locator('.today-reading-check')).toHaveCount(0);
  await leap.close();
});

test('Today narrow actions remain reachable and dark treatment stays legible', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await enrollCalendarPlan(page);
  await page.locator('.today-devotion').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const button = await page.locator('.today-devotion').boundingBox();
  const nav = await page.locator('.mobile-nav').boundingBox();
  expect(button!.y + button!.height).toBeLessThanOrEqual(nav!.y);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; window.scrollTo(0, 0); });
  await expectNoHorizontalOverflow(page);
  await expectNoAxeViolations(page);
  await page.screenshot({ path: info.outputPath('today-dark-preliminary.png'), animations: 'disabled', fullPage: true });
});
