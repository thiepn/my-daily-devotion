import { expect, test } from "@playwright/test";
import { holdLegacyDatabase } from "../ux/recovery-fixture";

for (const width of [320, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`blocked upgrade ${width} ${theme}`, async ({ context, page }) => {
      await holdLegacyDatabase(page);
      const next = await context.newPage(); await next.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await next.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await next.goto("/#/today");
      await expect(next.getByRole("heading", { name: "Finish writing in the other tab" })).toBeVisible();
      await next.evaluate(() => document.fonts.ready);
      await expect(next).toHaveScreenshot(`recovery-blocked-${width}-${theme}.png`, { fullPage: true });
      await page.evaluate(() => (window as unknown as { heldLegacy: IDBDatabase }).heldLegacy.close());
    });
  }
}
test("blocked upgrade enlarged text", async ({ context, page }) => {
  await holdLegacyDatabase(page); const next = await context.newPage(); await next.setViewportSize({ width: 320, height: 844 });
  await next.goto("/#/today"); await expect(next.getByRole("heading", { name: "Finish writing in the other tab" })).toBeVisible();
  await next.evaluate(() => { document.documentElement.style.fontSize = "200%"; return document.fonts.ready; });
  await expect(next).toHaveScreenshot("recovery-blocked-text200.png", { fullPage: true });
  await page.evaluate(() => (window as unknown as { heldLegacy: IDBDatabase }).heldLegacy.close());
});
