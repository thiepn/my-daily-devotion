import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openRoute, enrollCalendarPlan, expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";

async function person(page: Page, name: string, notes = "") {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Notes", { exact: false }).fill(notes);
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(page.locator(".metadata-row").filter({ hasText: name })).toBeVisible();
}
async function prayer(page: Page) {
  await openRoute(page, "/prayer/new");
  await page.getByLabel("What do you want to pray about?").fill("Pray for the visit.");
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Pray for the visit.");
  return page.url().split("#")[1]!;
}
async function failNextWrite(page: Page, table: string) {
  await page.evaluate((table) => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      if (this.name === table) { IDBObjectStore.prototype.add = original; throw new DOMException("Test storage full. Try again.", "QuotaExceededError"); }
      return original.apply(this, args);
    };
  }, table);
}

test("People in-page switches offer save, discard and cancel without losing notes", async ({ page }) => {
  await openRoute(page, "/prayer/people"); await person(page, "Anna", "Original"); await person(page, "Ben");
  const edit = (name: string) => page.locator(".metadata-row").filter({ hasText: name }).getByRole("button", { name: "Edit", exact: true });
  await edit("Anna").click(); await page.getByLabel("Notes", { exact: false }).fill("Keep these unsaved notes.");
  await edit("Ben").click(); const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Keep these unsaved notes.");
  await edit("Ben").click(); await dialog.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Ben");
  await edit("Anna").click(); await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Keep these unsaved notes.");
  await page.getByLabel("Notes", { exact: false }).fill("Discard only this draft."); await edit("Ben").click();
  await dialog.getByRole("button", { name: "Discard and continue" }).click(); await edit("Anna").click();
  await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Keep these unsaved notes.");
});

test("stale People notes can be compared without replacing the unsaved draft", async ({ page, context }) => {
  await openRoute(page, "/prayer/people"); await person(page, "Anna", "Original");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const other = await context.newPage(); await openRoute(other, "/prayer/people"); await other.getByRole("button", { name: "Edit", exact: true }).click();
  await other.getByLabel("Notes", { exact: false }).fill("Newer notes from another tab."); await other.getByRole("button", { name: "Save changes" }).click();
  await expect(other.getByLabel("Name", { exact: true })).toHaveValue("");
  await page.getByLabel("Name", { exact: true }).fill("Anne"); await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".prayer-form-status")).toContainText("another tab");
  await page.getByRole("button", { name: "Review latest saved version" }).click();
  await expect(page.getByLabel("Latest saved version")).toHaveValue(/Newer notes from another tab\./);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Anne");
  await page.getByRole("button", { name: "Use saved version" }).click();
  await expect(page.getByLabel("Notes", { exact: false })).toHaveValue("Newer notes from another tab.");
});

test("stale prayer settings preserve a newer schedule and event date", async ({ page, context }) => {
  const route = await prayer(page); await openRoute(page, `${route}/settings`);
  const other = await context.newPage(); await openRoute(other, `${route}/settings`);
  await other.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("DAILY");
  await other.getByLabel("Event date", { exact: false }).fill("2026-10-01"); await other.getByRole("button", { name: "Save details" }).click();
  await expect(other.getByLabel("Request", { exact: true })).toBeVisible();
  await page.getByLabel("Focus until", { exact: false }).fill("2026-10-04"); await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.locator(".prayer-form-status")).toContainText("another tab");
  await expect(page.getByLabel("Focus until", { exact: false })).toHaveValue("2026-10-04");
  await page.getByRole("button", { name: "Review latest saved version" }).click(); await page.getByRole("button", { name: "Use saved version" }).click();
  await expect(page.getByRole("combobox", { name: "Schedule", exact: true })).toHaveValue("DAILY");
  await expect(page.getByLabel("Event date", { exact: false })).toHaveValue("2026-10-01");
});

test("archiving saves wording and encouragement drafts only after explicit consent", async ({ page }) => {
  await prayer(page);
  await page.getByLabel("Request", { exact: true }).fill("A changed request worth keeping.");
  await page.getByLabel("Prayer update").fill("Keep this encouragement.");
  await page.getByRole("button", { name: "Encouragement", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Request", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Prayer update")).toHaveValue("Keep this encouragement.");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByLabel("Request", { exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue("A changed request worth keeping.");
  await expect(page.getByText("Keep this encouragement.", { exact: true })).toBeVisible();
});

test("answering preserves both request drafts and the separate answer note", async ({ page }) => {
  await prayer(page); await page.getByLabel("Request", { exact: true }).fill("Changed wording.");
  await page.getByLabel("Prayer update").fill("An important update.");
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  await page.getByLabel("What happened?", { exact: false }).fill("The visit went well.");
  await page.getByRole("button", { name: "Mark answered", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Prayer marked answered.")).toBeVisible(); await page.reload();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Changed wording.");
  await expect(page.getByText("An important update.", { exact: true })).toBeVisible();
  await expect(page.getByText("The visit went well.", { exact: true })).toBeVisible();
});

test("failed enrollment and reading writes show an error and succeed on retry", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await openRoute(page, "/today"); await expect(page.getByRole("button", { name: /Follow today’s calendar/ })).toBeVisible();
  await failNextWrite(page, "planEnrollments"); await page.getByRole("button", { name: /Follow today’s calendar/ }).click();
  await expect(page.getByRole("alert")).toContainText("Test storage full");
  await page.getByRole("button", { name: /Follow today’s calendar/ }).click();
  await expect(page.getByText("0 of 4", { exact: true })).toBeVisible();
  await failNextWrite(page, "readingProgress"); await page.locator(".reading-toggle").first().click();
  await expect(page.getByRole("alert")).toContainText("Test storage full");
  await expect(page.getByText("0 of 4", { exact: true })).toBeVisible();
  await page.locator(".reading-toggle").first().click();
  await expect(page.getByText("1 of 4", { exact: true })).toBeVisible(); expect(errors).toEqual([]);
});

test("Today refreshes at local midnight without changing a historical reflection", async ({ page, context }) => {
  await page.clock.install({ time: new Date("2026-09-17T21:59:50Z") });
  await page.clock.pauseAt(new Date("2026-09-17T21:59:58Z"));
  await enrollCalendarPlan(page); await expect(page.getByRole("heading", { name: "Day 260 readings" })).toBeVisible();
  await page.clock.fastForward(5000); await expect(page.getByRole("heading", { name: "Day 261 readings" })).toBeVisible();
  const other = await context.newPage(); await openRoute(other, "/today/reflection/2026-09-17");
  await other.getByLabel("Daily reflection").fill("A historical reflection remains dated.");
  await other.getByRole("button", { name: "Save reflection" }).click(); await other.reload();
  await expect(other.getByLabel("Daily reflection")).toHaveValue("A historical reflection remains dated.");
});

test("copy preserves poetry line boundaries and the reader keeps quotation spacing", async ({ page }) => {
  await openRoute(page, "/bible/PSA/27?verse=14");
  await expect(page.getByRole("button", { name: "Select Psalms 27:14", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.copied = text; } } }); });
  await page.getByRole("button", { name: "More", exact: true }).click(); await page.getByRole("button", { name: "Copy selection" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.copied)).toContain("LORD; be strong");
  await openRoute(page, "/bible/MAT/4?verse=19"); await expect(page.locator(".scripture-copy")).toContainText("“Come, follow Me,” Jesus said");
});

test("encrypted backup restores in a fresh browser context on this engine", async ({ page, browser }) => {
  const route = await prayer(page); await openRoute(page, "/data");
  await page.getByLabel("Encrypted backup password").fill("engine-test-passphrase");
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "Download encrypted backup", exact: true }).click();
  const file = await downloadPromise, bytes = await readFile((await file.path())!);
  const target = await browser.newContext({ baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" });
  try {
    const restored = await target.newPage(); await openRoute(restored, "/data");
    await restored.getByLabel("Backup file").setInputFiles({ name: "test.mddbackup", mimeType: "application/zip", buffer: bytes });
    await restored.getByLabel("Backup password", { exact: false }).last().fill("engine-test-passphrase");
    await restored.getByRole("button", { name: "Preview & validate" }).click();
    await restored.getByRole("button", { name: "Merge validated backup" }).click();
    await expect(restored.getByRole("status")).toContainText("merged successfully");
    await openRoute(restored, route); await expect(restored.getByLabel("Request", { exact: true })).toHaveValue("Pray for the visit.");
  } finally { await target.close(); }
});
