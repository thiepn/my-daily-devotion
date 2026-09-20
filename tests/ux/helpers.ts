import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export function visibleNavLink(page: Page, name: string): Locator { return page.getByRole("link", { name, exact: true }).visible(); }
export async function openRoute(page: Page, route: string): Promise<void> { await page.goto(`/#${route}`); await expect(page.locator("main").first()).toBeVisible(); }
export async function expectNoHorizontalOverflow(page: Page): Promise<void> { const overflow=await page.evaluate(()=>({root:document.documentElement.scrollWidth-document.documentElement.clientWidth,body:document.body.scrollWidth-document.body.clientWidth})); expect(overflow.root,`document overflowed horizontally by ${overflow.root}px`).toBeLessThanOrEqual(1); expect(overflow.body,`body overflowed horizontally by ${overflow.body}px`).toBeLessThanOrEqual(1); }
export async function expectNoAxeViolations(page: Page): Promise<void> { const results=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]).analyze(); const summary=results.violations.map((violation)=>({id:violation.id,impact:violation.impact,help:violation.help,targets:violation.nodes.flatMap((node)=>node.target)})); expect(summary,JSON.stringify(summary,null,2)).toEqual([]); }
export async function enrollCalendarPlan(page: Page): Promise<void> {
  await openRoute(page,"/today");
  const setup=page.getByRole("button",{name:/Follow today’s calendar/i});
  const readingHeading=page.getByRole("heading",{level:2,name:/Day \d+ readings|Leap-day pause|Reading plan/});
  await expect(setup.or(readingHeading).first()).toBeVisible();
  if(await setup.isVisible()) await setup.click();
  await expect(readingHeading).toBeVisible();
}

export async function expectCanonicalTitle(page: Page, name: "Today" | "Bible" | "Prayer" | "History"): Promise<void> {
  if ((page.viewportSize()?.width ?? 9999) <= 760) {
    await expect(page.locator(".utility-mobile-title")).toHaveText(name);
    await expect(page.locator("h1").filter({ hasText: name })).toHaveCount(1);
  } else {
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
  }
}
