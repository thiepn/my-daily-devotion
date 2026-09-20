import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { enrollCalendarPlan, expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

type Surface = [string, string, string];
const emptySurfaces: Surface[] = [["today", "/today", "Today"], ["bible", "/bible/JHN/3", "Bible"], ["reflection", "/today/reflection/2026-09-17", "Reflect"], ["prayer", "/prayer", "Prayer"], ["history", "/history", "History"], ["search", "/search", "Search"], ["collections", "/bible/collections", "Collections"], ["data", "/data", "Your data"]];
async function setVisualTheme(page: Page, mode: "light" | "dark" | "system") {
  await page.evaluate((next) => {
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = next;
  }, mode);
}

async function capture(page: Page, testInfo: TestInfo, name: string, surface: Surface) {
  await openRoute(page, surface[1]); await expect(page.getByRole("heading", { level: 1, name: surface[2], exact: true })).toBeVisible();
  if (surface[0] === "bible") await expect(page.locator(".scripture-copy")).toBeVisible();
  if (surface[0] === "search-results") await expect(page.locator(".search-hit").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath(`${name}-${surface[0]}.png`), animations: "disabled" });
}

test("visual record of empty major screens in light, dark, and mobile", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  for (const mode of ["light", "dark", "mobile", "mobile-dark"]) {
    await page.setViewportSize(mode.includes("mobile") ? { width: mode === "small-mobile" ? 320 : 390, height: mode === "small-mobile" ? 568 : 844 } : mode === "tablet-portrait" ? { width: 768, height: 1024 } : mode === "tablet-landscape" ? { width: 1024, height: 768 } : { width: 1440, height: 900 });
    await openRoute(page, "/today"); await setVisualTheme(page, mode.includes("dark") ? "dark" : "light");
    for (const surface of emptySurfaces) await capture(page, testInfo, `empty-${mode}`, surface);
  }
});

test("visual record of populated devotional journeys and management screens", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await enrollCalendarPlan(page);
  await page.locator(".reading-toggle").first().click();
  await expect(page.getByText("1 of 4", { exact: true })).toBeVisible();
  await openRoute(page, "/prayer/people"); await page.getByLabel("Name", { exact: true }).fill("Anna"); await page.getByLabel("Relationship", { exact: false }).fill("Family");
  await page.getByRole("button", { name: "Add person", exact: true }).click(); await expect(page.locator(".metadata-row").filter({ hasText: "Anna" })).toBeVisible();
  await openRoute(page, "/today/reflection/2026-09-17?translation=BSB&start=JHN.3.16&end=JHN.3.16");
  await page.getByLabel("Daily reflection").fill("God’s love invites a generous response.\n\nToday I want to listen carefully and show kindness to my family, especially when the day feels hurried.");
  await page.getByRole("button", { name: "Save reflection" }).click(); await expect(page.getByText("Reflection created and saved locally.")).toBeVisible();
  await page.getByRole("link", { name: "Create prayer →" }).click();
  await page.getByLabel("What do you want to pray about?").fill("Give Anna wisdom and peace for the week ahead.");
  await page.getByRole("button", { name: "Add details", exact: true }).click(); await page.getByRole("combobox", { name: "Person optional", exact: true }).selectOption({ label: "Anna" });
  await page.getByRole("combobox", { name: "Category optional", exact: true }).selectOption({ label: "Family" }); await page.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("DAILY");
  await page.getByRole("button", { name: "Save prayer" }).click(); await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Give Anna wisdom and peace for the week ahead.");
  const prayer = page.url().split("#")[1]!;
  await page.getByLabel("Prayer update").fill("We had a good conversation today. Keep helping me listen."); await page.getByRole("button", { name: "Add update", exact: true }).click();
  await expect(page.getByText("Update recorded.")).toBeVisible(); await page.getByRole("button", { name: "Prayed now" }).click();
  await expect(page.getByText("Prayed now recorded.")).toBeVisible();
  await openRoute(page, "/prayer/new"); await page.getByLabel("What do you want to pray about?").fill("Help me listen with patience and speak with kindness today.");
  await page.getByRole("button", { name: "Save prayer" }).click(); await expect(page.getByLabel("Request", { exact: true })).toBeVisible();
  await openRoute(page, "/bible/collections?translation=BSB&start=JHN.3.16&end=JHN.3.16"); await page.getByLabel("New collection").fill("Promises to remember");
  await page.getByRole("button", { name: "Add", exact: true }).click(); await page.getByRole("button", { name: "Add selected passage to Promises to remember" }).click();
  await expect(page.getByRole("link", { name: "John 3:16", exact: true })).toBeVisible();
  await openRoute(page, "/bible/JHN/3?verse=16");
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove highlight" })).toBeVisible();
  const surfaces: Surface[] = [
    ...emptySurfaces.filter((item) => item[0] !== "search"),
    ["plan", "/today/plan", "Reading plan"], ["prayer-new", "/prayer/new", "Add prayer"], ["prayer-detail", prayer, "Prayer"],
    ["prayer-settings", `${prayer}/settings`, "Prayer details"], ["people", "/prayer/people", "People"], ["categories", "/prayer/categories", "Categories"],
    ["moments", "/history/moments", "Moments"], ["search-results", "/search?q=love", "Search"],
  ];
  for (const mode of ["light", "dark", "mobile", "mobile-dark", "small-mobile", "tablet-portrait", "tablet-landscape"] as const) {
    await page.setViewportSize(mode.includes("mobile") ? { width: mode === "small-mobile" ? 320 : 390, height: mode === "small-mobile" ? 568 : 844 } : mode === "tablet-portrait" ? { width: 768, height: 1024 } : mode === "tablet-landscape" ? { width: 1024, height: 768 } : { width: 1440, height: 900 });
    await setVisualTheme(page, mode.includes("dark") ? "dark" : "light");
    for (const surface of surfaces) await capture(page, testInfo, `populated-${mode}`, surface);
    await openRoute(page, "/prayer/session?depth=quick"); await expect(page.locator(".focused-prayer-card")).toBeVisible();
    await expectNoHorizontalOverflow(page); await page.screenshot({ path: testInfo.outputPath(`populated-${mode}-focused-prayer.png`) });
    await expectNoAxeViolations(page);
    await openRoute(page, "/history"); await page.locator(".history-day[href]").first().click();
    await expect(page.locator(".history-entry").first()).toBeVisible(); await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`populated-${mode}-history-day.png`) });
  }
  expect(errors).toEqual([]);
});

test("requested viewport matrix, system theme, text scaling and Scripture forms", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  for (const [width, height] of [[1440,900],[1920,1080],[768,1024],[1024,768],[320,568],[360,800],[390,844],[430,932],[844,390]]) {
    await page.setViewportSize({ width: width!, height: height! });
    for (const surface of emptySurfaces.filter((item) => ["today","bible","prayer","history"].includes(item[0]))) await capture(page, testInfo, `${width}x${height}`, surface);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme: scheme }); await setVisualTheme(page, "system");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    await capture(page, testInfo, `system-${scheme}`, ["bible", "/bible/PSA/23", "Bible"]);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [book, chapter] of [["GEN",1],["PSA",119],["PRO",3],["ISA",53],["MAT",5],["ROM",8],["OBA",1],["REV",22]]) {
    await openRoute(page, `/bible/${book}/${chapter}`); await expect(page.locator(".scripture-copy")).toBeVisible();
    await expectNoHorizontalOverflow(page); await page.screenshot({ path: testInfo.outputPath(`scripture-${book}-${chapter}.png`) });
  }
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await openRoute(page, "/bible/GEN/1"); await expect(page.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.fontSize = "200%"; }));
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("font-size", "32px");
  for (const surface of emptySurfaces) await capture(page, testInfo, "text-200", surface);
});

test("compact verse-note editing and storage recovery visual states", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 568 });
    await openRoute(page, "/bible/JHN/3?verse=16");
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("button", { name: "Add verse note" }).click();
    await page.getByLabel("Verse note", { exact: true }).fill("A quiet reminder of God’s love.");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(page.getByText("Verse note saved locally.")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`note-editor-${width}.png`) });
    // Remove the test note so each viewport exercises the same capture state.
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Remove note", exact: true }).click();
    await expect(page.getByText("Verse note removed from current views.")).toBeVisible();
  }
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, "open", { value() { throw new DOMException("The user denied permission to access the database.", "SecurityError"); } });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "My Daily Devotion could not open its local data." })).toBeVisible();
  await expect(page.getByText(/MDD has not cleared your saved data/)).toBeVisible();
  await expect(page.getByText("The user denied permission to access the database.")).not.toBeVisible();
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
  await page.screenshot({ path: testInfo.outputPath("storage-unavailable.png"), fullPage: true });
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.getByText("The user denied permission to access the database.")).toBeVisible();
});
