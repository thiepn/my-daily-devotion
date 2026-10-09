import { expect, test } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

const keyRoutes = ["/today", "/bible/JHN/3", "/prayer", "/history", "/search", "/data"] as const;

test.describe("P7 accessible Morning Grace and resource qualification", () => {
  test("Bible book and appearance dialogs expose open state, restore focus and pass automated AA checks", async ({ page }) => {
    await openRoute(page, "/bible/JHN/3");
    const passage = page.getByRole("button", { name: "Choose book and chapter" });
    await expect(passage).toHaveAttribute("aria-expanded", "false");
    await passage.click();
    await expect(passage).toHaveAttribute("aria-expanded", "true");
    const dialog = page.getByRole("dialog", { name: "Open Scripture" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Book")).toBeFocused();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(passage).toHaveAttribute("aria-expanded", "false");
    await expect(passage).toBeFocused();

    const appearance = page.getByRole("button", { name: "Reading appearance" });
    await appearance.click();
    await expect(appearance).toHaveAttribute("aria-expanded", "true");
    const reading = page.getByRole("dialog", { name: "Reading" });
    await expect(reading.getByLabel("Reading font")).toBeFocused();
    await expectNoAxeViolations(page);
    await page.keyboard.press("Escape");
    await expect(appearance).toBeFocused();
    await expect(appearance).toHaveAttribute("aria-expanded", "false");
  });

  test("200% text at 320px reflows across primary destinations without horizontal clipping", async ({ page }) => {
    test.setTimeout(100_000);
    await page.setViewportSize({ width: 320, height: 568 });
    for (const route of keyRoutes) {
      await openRoute(page, route);
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      await expectNoHorizontalOverflow(page);
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

  test("reduced motion disables visible transitions across devotional screens", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/today", "/bible/JHN/3", "/prayer", "/history", "/data"]) {
      await openRoute(page, route);
      const moving = await page.evaluate(() => {
        const samples = [document.querySelector("main"), document.querySelector(".mobile-nav"), document.querySelector(".utility-bar")].filter(Boolean) as HTMLElement[];
        return samples.flatMap(element => {
          const style = getComputedStyle(element);
          const seconds = style.animationDuration.split(",").map(Number.parseFloat);
          const transitions = style.transitionDuration.split(",").map(Number.parseFloat);
          return [...seconds, ...transitions].filter(duration => Number.isFinite(duration) && duration > 0.001);
        });
      });
      expect(moving, "Reduced-motion transitions on " + route).toEqual([]);
    }
  });

  test("light and dark screen readers have no automated AA violations", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ["light", "dark"] as const) {
      for (const route of ["/today", "/bible/JHN/3", "/prayer", "/history"]) {
        await openRoute(page, route);
        await page.evaluate(mode => { document.documentElement.dataset.theme = mode; }, theme);
        await expectNoAxeViolations(page);
      }
    }
  });

  test("long Psalm reading stays within documented resource and DOM budgets", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openRoute(page, "/bible/PSA/119");
    await expect(page.getByRole("button", { name: /Select Psalms? 119:176/ })).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; });
    const measurements = await page.evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const sizes = resources.map(resource => ({
        kind: resource.initiatorType,
        encodedBytes: resource.encodedBodySize,
        transferBytes: resource.transferSize,
        milliseconds: Math.round(resource.duration),
      }));
      return {
        route: "PSA 119",
        viewport: { width: innerWidth, height: innerHeight },
        nodeCount: document.querySelectorAll("*").length,
        verseButtons: document.querySelectorAll(".scripture-reader .verse-number").length,
        resources: sizes.length,
        encodedBytes: sizes.reduce((total, row) => total + row.encodedBytes, 0),
        largestEncodedBytes: Math.max(0, ...sizes.map(row => row.encodedBytes)),
        navigationMilliseconds: Math.round((performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.duration ?? 0),
        memoryBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
      };
    });
    await testInfo.attach("p7-scripture-resource-metrics.json", { body: Buffer.from(JSON.stringify(measurements, null, 2)), contentType: "application/json" });
    expect(measurements.verseButtons).toBe(176);
    expect(measurements.nodeCount).toBeLessThan(12_000);
    expect(measurements.largestEncodedBytes).toBeLessThan(12 * 1024 * 1024);
    expect(measurements.encodedBytes).toBeLessThan(35 * 1024 * 1024);
    await page.getByRole("button", { name: /Select Psalms? 119:1/ }).click();
    await expect(page.getByRole("button", { name: "Select Psalms 119:1" })).toHaveAttribute("aria-pressed", "true");
    await expectNoHorizontalOverflow(page);
  });
});
