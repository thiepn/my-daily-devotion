import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("P3 mobile device resilience and input visibility", () => {
  test("narrow-screen text entry hides the fixed bottom bar only while the viewport is keyboard-sized", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, "/today");
    await expect(page.locator(".mobile-nav")).toBeVisible();
    await page.evaluate(() => {
      const textarea = document.createElement("textarea");
      textarea.setAttribute("aria-label", "Keyboard visibility probe");
      document.querySelector(".workspace-content")!.appendChild(textarea);
      textarea.focus();
    });
    const field = page.getByRole("textbox", { name: "Keyboard visibility probe" });
    await field.fill("Writing that must not be covered.");
    await expect(page.locator(".mobile-nav")).toBeVisible(); // Focus alone is not a keyboard.
    await page.setViewportSize({ width: 390, height: 554 });
    await expect(page.locator(".app-shell")).toHaveClass(/mobile-keyboard-visible/);
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expect(field).toHaveValue("Writing that must not be covered.");
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".app-shell")).not.toHaveClass(/mobile-keyboard-visible/);
    await expect(page.locator(".mobile-nav")).toBeVisible();
    await expect(field).toHaveValue("Writing that must not be covered.");
  });

  test("focus loss restores navigation even before the keyboard-sized viewport grows", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, "/today");
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.setAttribute("aria-label", "Focus probe");
      document.querySelector(".workspace-content")!.appendChild(input);
      input.focus();
    });
    await page.setViewportSize({ width: 390, height: 544 });
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await page.getByRole("textbox", { name: "Focus probe" }).blur();
    await expect(page.locator(".mobile-nav")).toBeVisible();
  });

  test("a blocked IndexedDB upgrade is explained, not mistaken for a completed upgrade", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, "/today");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:database-connection", { detail: "blocked" })));
    await expect(page.getByText("Another tab is blocking a storage update.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload when ready" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:database-connection", { detail: "ready" })));
    await expect(page.getByText("Another tab is blocking a storage update.", { exact: false })).toBeHidden();
  });

  test("malformed and self-referential return links cannot trap mobile Back", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/search?return=%2Fsearch", "/data?return=%2Fdata", "/search?return=%2F%5Cexample.com", "/data?return=%2F%2Fexample.com", "/search?return=%2Funknown"]) {
      await openRoute(page, route);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page).toHaveURL(/#\/today$/);
    }
    await openRoute(page, "/search?return=%2Fprayer%3Fstatus%3DWAITING");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/#\/prayer\?status=WAITING$/);
  });

  test("an already upgraded connection offers reload, not a destructive data reset", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openRoute(page, "/today");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("mdd:database-connection", { detail: "closed-for-upgrade" })));
    await expect(page.getByText("Another tab updated local storage.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload when ready" })).toBeVisible();
    await expect(page.getByText("Saved records have not been cleared.", { exact: false })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
