import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

test.describe("dense secondary mobile workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Measure settled controls: entrance transforms can report 43.999992px for a 44px target.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("People and Categories open on the directory with editing on demand", async ({ page }) => {
    for (const [kind,label] of [["people","person"],["categories","category"]]) {
      await openRoute(page,"/prayer/"+kind); await expect(page.locator(".directory-list")).toBeVisible(); await expect(page.locator(".directory-editor")).toHaveCount(0);
      await page.getByRole("button",{name:"Add "+label,exact:true}).click(); await expect(page.locator(".directory-editor")).toBeVisible();
      const box=await page.getByRole("button",{name:"Save "+label,exact:true}).boundingBox(); expect(box?.height??0).toBeGreaterThanOrEqual(44); await expectNoHorizontalOverflow(page);
    }
  });

  test("Prayer detail is a readable journal story with visible status context", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("Give wisdom and patience today.");
    await page.getByRole("button", { name: "Save prayer", exact: true }).click();
    await expect(page.locator(".prayer-request-text")).toHaveText("Give wisdom and patience today.");

    const eyebrow = page.locator(".prayer-record .journal-date");
    await expect(eyebrow).toBeVisible();
    await expect(eyebrow).toContainText("active");

    const lifecycle = page.locator(".prayer-record-actions");
    await expect(lifecycle).toHaveCSS("display", "flex");
    const buttons = lifecycle.getByRole("button");
    for (let index = 0; index < await buttons.count(); index += 1) {
      const box = await buttons.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await expect(page.locator(".prayer-record-settings")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
  });

  test("Prayer Settings groups fields with actions in document flow", async ({ page }) => {
    await openRoute(page, "/prayer/new");
    await page.getByLabel("What do you want to pray about?").fill("Pray faithfully this week.");
    await page.getByRole("button", { name: "Save prayer", exact: true }).click();
    await expect(page.locator(".prayer-request-text")).toHaveText("Pray faithfully this week.");
    await page.getByRole("link", { name: "Edit details", exact: true }).click();

    await expect(page.locator(".prayer-settings-paper")).toBeVisible();
    const actions = page.locator(".prayer-settings-actions");
    await expect(actions).toHaveCSS("position", "static");
    const saveBox = await page.getByRole("button", { name: "Save details", exact: true }).boundingBox();
    expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoHorizontalOverflow(page);
  });

  test("History Day keeps its date visible after the desktop title collapses", async ({ page }) => {
    await openRoute(page, "/history/day/2026-09-21");
    const context = page.locator(".history-day-screen h1");
    await expect(context).toBeVisible();
    await expect(context).toContainText("2026");
    await expect(page.locator(".mobile-nav")).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("History Moments keeps its period and search controls accessible", async ({ page }) => {
    await openRoute(page, "/history/moments");
    const tabs = page.locator(".history-journal-heading");
    await expect(tabs).toBeVisible();
    await expect(page.getByLabel("History period")).toBeVisible();
    const links = tabs.getByRole("link");
    for (let index = 0; index < await links.count(); index += 1) {
      await expect(links.nth(index)).toBeVisible();
      const box = await links.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("dense management screens remain usable at 320px and 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));

    for (const route of ["/prayer/people", "/prayer/categories", "/history/moments", "/history/day/2026-09-21"]) {
      await openRoute(page, route);
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      await expectNoHorizontalOverflow(page);
    }
  });

  test("desktop directories use a centered journal column", async ({ page }) => {
    await page.setViewportSize({width:1440,height:900}); await openRoute(page,"/prayer/people");
    await expect(page.locator(".directory-list")).toBeVisible(); const box=await page.locator(".metadata-journal").boundingBox(); expect(box?.width??Infinity).toBeLessThanOrEqual(760);
    await page.getByRole("button",{name:"Add person",exact:true}).click(); await expect(page.locator(".directory-editor")).toBeVisible(); await expectNoHorizontalOverflow(page);
  });
});
