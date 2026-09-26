import { expect, test } from '@playwright/test';
import { openRoute, expectNoAxeViolations, expectNoHorizontalOverflow } from './helpers';
import { seedPrayerJournal, prayerDatabaseSnapshot } from './prayer-fixture';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-04-24T07:00:00+02:00'));
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
});

test('Prayer filtering, pagination and navigation preserve data and return context', async ({ page }) => {
  await seedPrayerJournal(page, { count: 17 });
  const before = await prayerDatabaseSnapshot(page);
  await page.getByRole('button', { name: 'Show more', exact: true }).click();
  await expect(page.locator('.prayer-journal-row')).toHaveCount(15);
  await page.getByRole('button', { name: 'Show more', exact: true }).click();
  await expect(page.locator('.prayer-journal-row')).toHaveCount(17);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Person', { exact: true }).selectOption('person-0');
  await page.getByLabel('Category', { exact: true }).selectOption('family');
  await expect(page.locator('.prayer-journal-row')).toHaveCount(2);
  await expect(page.getByRole('navigation', { name: 'Prayer status' })).toContainText('Active17');
  const filtered = page.url();
  await page.locator('.prayer-journal-tabs a').filter({ hasText: 'Answered' }).click();
  await expect(page).toHaveURL(/person=person-0.*category=family.*status=ANSWERED/);
  await expect(page.getByText('No matching requests.')).toBeVisible();
  await page.goBack();
  await page.locator('.prayer-journal-row').first().click();
  await expect(page.getByRole('button', { name: 'Prayed now', exact: true })).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(filtered);
  await page.getByRole('link', { name: 'Add prayer', exact: true }).click();
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(filtered);
  await page.getByRole('button', { name: 'Filters · On', exact: true }).click();
  await page.locator('.prayer-session-length summary').click();
  expect(await prayerDatabaseSnapshot(page)).toEqual(before);
});

test('Prayer previews saved order and resumes only after explicit action', async ({ page }) => {
  await seedPrayerJournal(page, { session: true });
  const before = await prayerDatabaseSnapshot(page);
  await expect(page.locator('.prayer-focus-card')).toContainText('Parents');
  await expect(page.getByRole('link', { name: 'Resume prayer', exact: true })).toBeVisible();
  await page.reload(); await expect(page.locator('.prayer-focus-card')).toContainText('Parents');
  expect(await prayerDatabaseSnapshot(page)).toEqual(before);
  await page.getByRole('link', { name: 'Resume prayer', exact: true }).click();
  await expect(page.locator('.focused-prayer-card h1')).toHaveText('Health and daily encouragement.');
  await page.getByRole('button', { name: /Prayed · Next/ }).click();
  await expect(page.locator('.focused-prayer-card h1')).toHaveText('Courage and patience in a new season.');
});

test('Prayer removes invalid filters and preserves manual-only requests', async ({ page }) => {
  await seedPrayerJournal(page, { manual: true });
  const before = await prayerDatabaseSnapshot(page);
  await openRoute(page, '/prayer?status=UNKNOWN&person=missing&category=deleted');
  await expect(page).toHaveURL(/#\/prayer\?status=ACTIVE$/);
  await expect(page.locator('.prayer-journal-row')).toHaveCount(5);
  await expect(page.locator('.prayer-focus-card')).toContainText('No requests are eligible');
  await expect(page.getByRole('link', { name: 'Begin prayer', exact: true })).toHaveCount(0);
  expect(await prayerDatabaseSnapshot(page)).toEqual(before);
});

test('Prayer uses real BSB text and remains usable if the quotation cannot load', async ({ page }) => {
  await seedPrayerJournal(page);
  await expect(page.locator('.prayer-quotation blockquote')).toHaveText('“Devote yourselves to prayer, being watchful and thankful,”');
  await page.route('**/bible/books/COL.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload();
  await expect(page.locator('.prayer-quotation')).toContainText('A moment to bring your heart to God.');
  await expect(page.locator('.prayer-journal-row')).toHaveCount(5);
});

test('Prayer refreshes on foreground and civil midnight without writing', async ({ page }) => {
  await seedPrayerJournal(page, { session: true });
  const before = await prayerDatabaseSnapshot(page);
  await page.clock.setFixedTime(new Date('2026-04-25T00:01:00+02:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: 'Begin prayer', exact: true })).toBeVisible();
  await expect(page.locator('.prayer-focus-card h3')).toHaveText('Anna');
  expect(await prayerDatabaseSnapshot(page)).toEqual(before);
});

test('Prayer reflows with visible artwork, keyboard filters and 44px controls', async ({ page }) => {
  await seedPrayerJournal(page);
  for (const width of [320,360,390,430,768,1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('.prayer-focus-caption img')).toBeVisible();
    const controls = await page.locator('.prayer-add, .prayer-journal-tabs a, .prayer-list-heading button, .prayer-focus-action, .prayer-session-length summary').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    controls.forEach(height => expect(height).toBeGreaterThanOrEqual(44));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await page.locator('.prayer-focus-card').boundingBox();
  expect(card!.y).toBeLessThan(680);
  await page.getByRole('button', { name: 'Filters', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Person', { exact: true })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expectNoHorizontalOverflow(page);
  await expect(page.locator('.prayer-journal-tabs')).toHaveCSS('grid-template-columns', /\d+.* \d+/);
  const labelBounds = await page.locator('.mobile-nav .nav-link').evaluateAll(links => links.map(link => {
    const label = link.querySelector('span')!; const range = document.createRange(); range.selectNodeContents(label);
    const text = range.getBoundingClientRect(); const box = link.getBoundingClientRect();
    return { left: text.left - box.left, right: box.right - text.right };
  }));
  labelBounds.forEach(bounds => { expect(bounds.left).toBeGreaterThanOrEqual(-1); expect(bounds.right).toBeGreaterThanOrEqual(-1); });
  await expectNoAxeViolations(page);
});

test('Prayer dark theme preserves contrast and identity', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); await seedPrayerJournal(page);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expectNoAxeViolations(page); await expectNoHorizontalOverflow(page);
});

test('Prayer library failures offer retry without losing saved requests', async ({ page }) => {
  await seedPrayerJournal(page);
  const before = await prayerDatabaseSnapshot(page);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.openCursor;
    let fail = true;
    IDBObjectStore.prototype.openCursor = function(...args) {
      if (this.name === 'people' && fail) { fail = false; throw new DOMException('Test read failure', 'UnknownError'); }
      return original.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Could not open prayers');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.prayer-journal-row')).toHaveCount(5);
  expect(await prayerDatabaseSnapshot(page)).toEqual(before);
});

test('Prayer preview failure leaves the library usable', async ({ page }) => {
  await seedPrayerJournal(page);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.openCursor;
    let fail = true;
    IDBObjectStore.prototype.openCursor = function(...args) {
      if (this.name === 'prayerSchedules' && fail) { fail = false; throw new DOMException('Test preview failure', 'UnknownError'); }
      return original.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByText('Could not open the prayer preview. Your list is still available.')).toBeVisible();
  await expect(page.locator('.prayer-journal-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Retry preview', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Begin prayer', exact: true })).toBeVisible();
});
