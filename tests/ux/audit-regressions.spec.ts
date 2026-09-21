import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { expectCanonicalTitle, expectRouteTitle, openRoute, usesMobileAppLayout, visibleNavLink, expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";

async function createPrayer(page: Page, body: string, schedule?: string) {
  await openRoute(page, "/prayer/new");
  await page.getByLabel("What do you want to pray about?").fill(body);
  if (schedule) { await page.getByRole("button", { name: "Add details", exact: true }).click(); await page.getByRole("combobox", { name: "Schedule", exact: true }).selectOption(schedule); }
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue(body.trim());
  return page.url().split("#")[1]!;
}
async function backup(page: Page, encrypted = false) {
  await openRoute(page, "/data");
  if (encrypted) await page.getByLabel("Encrypted backup password").fill("test-only-backup-passphrase");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: encrypted ? "Download encrypted backup" : "Download plain backup", exact: true }).click();
  const download = await downloading;
  return readFile((await download.path())!);
}
async function upload(page: Page, bytes: Buffer) {
  await page.getByLabel("Backup file").setInputFiles({ name: "test.mddbackup", mimeType: "application/zip", buffer: bytes });
  await expect(page.getByRole("button", { name: "Preview & validate" })).toBeEnabled();
}

test("reflection drafts survive cancelled navigation, reload and stale saves", async ({ page, context }) => {
  await openRoute(page, "/today/reflection/2026-09-17");
  const editor = page.getByLabel("Daily reflection");
  await editor.fill("A reflection worth keeping.\nA second line.");
  const leaveReflection = () => usesMobileAppLayout(page)
    ? page.getByRole("button", { name: "Back" }).click()
    : visibleNavLink(page, "Today").click();
  await Promise.all([
    page.waitForEvent("dialog").then(async (dialog) => { expect(dialog.type()).toBe("confirm"); await dialog.dismiss(); }),
    leaveReflection(),
  ]);
  await expect(editor).toHaveValue("A reflection worth keeping.\nA second line.");
  // Reload is tested via the native beforeunload event, with a real user gesture above.
  await Promise.all([
    page.waitForEvent("dialog").then(async (dialog) => { expect(dialog.type()).toBe("beforeunload"); await dialog.dismiss(); }),
    page.reload({ timeout: 2000, waitUntil: "commit" }).catch(() => undefined),
  ]);
  await expect(editor).toHaveValue("A reflection worth keeping.\nA second line.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByText("Reflection created and saved locally.")).toBeVisible();
  const other = await context.newPage(); await openRoute(other, "/today/reflection/2026-09-17");
  await other.getByLabel("Daily reflection").fill("A newer version from a second tab.");
  await other.getByRole("button", { name: "Save reflection" }).click();
  await expect(other.getByText("Reflection saved locally.")).toBeVisible();
  await editor.fill("My older draft is still here.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.locator(".reflection-status")).toContainText("another tab");
  await expect(editor).toHaveValue("My older draft is still here.");
  await other.reload(); await expect(other.getByLabel("Daily reflection")).toHaveValue("A newer version from a second tab.");
});

test("verse notes protect drafts and saved annotations survive reload", async ({ page }, testInfo) => {
  await openRoute(page, "/bible/JHN/3?verse=16");
  const verse = page.getByRole("button", { name: "Select John 3:16", exact: true });
  await expect(verse).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove highlight" })).toBeVisible();
  await page.getByRole("button", { name: "Bookmark", exact: true }).click();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Add verse note" }).click();
  await page.getByLabel("Verse note", { exact: true }).fill("Remember this promise of love.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Clear verse selection" }).click();
  await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("Remember this promise of love.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByLabel("Verse note", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText("Verse note saved locally.")).toBeVisible();
  await page.reload(); await expect(verse).toHaveClass(/is-bookmarked/); await expect(verse).toHaveClass(/is-noted/);
  await page.getByRole("button", { name: "More", exact: true }).click(); await page.getByRole("button", { name: "Edit verse note" }).click();
  await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("Remember this promise of love.");
  await openRoute(page, "/search?q=Remember+this+promise");
  await expect(page.locator(".search-hit").filter({ hasText: "Verse note" }).locator("strong")).toHaveText("John 3:16");
  await page.screenshot({ path: testInfo.outputPath("search-verse-note-reference.png") });
});

test("prayer activity preserves draft wording and archive restores answered state", async ({ page }) => {
  await createPrayer(page, "Give us patience and wisdom.");
  await page.getByLabel("Request", { exact: true }).fill("Give us patience, wisdom, and kindness.");
  await page.getByRole("button", { name: "Prayed now", exact: true }).click();
  await expect(page.getByText("Prayed now recorded.")).toBeVisible();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue("Give us patience, wisdom, and kindness.");
  await page.getByRole("button", { name: "Save wording" }).click();
  await expect(page.getByText("Prayer saved locally.")).toBeVisible();
  await page.getByLabel("Prayer update").fill("A conversation brought encouragement.");
  await page.getByRole("button", { name: "Encouragement", exact: true }).click();
  await page.getByRole("button", { name: "Add encouragement", exact: true }).click();
  await expect(page.getByText("Encouragement recorded.")).toBeVisible();
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  await page.getByLabel("What happened?").fill("We found a peaceful way forward.");
  await page.getByRole("button", { name: "Mark answered", exact: true }).click();
  await expect(page.getByText("Prayer marked answered.")).toBeVisible();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("button", { name: "Restore to answered" }).click();
  await expect(page.locator(".prayer-detail-heading")).toContainText("answered");
  await expect(page.getByText("We found a peaceful way forward.")).toBeVisible();
  await page.reload(); await expect(page.getByText("We found a peaceful way forward.")).toBeVisible();
});

test("scheduled prayer session resumes after exit and reload", async ({ page }) => {
  await createPrayer(page, "First daily request.", "DAILY");
  await createPrayer(page, "Second daily request.", "DAILY");
  await createPrayer(page, "Manual request stays out of sessions.", "MANUAL_ONLY");
  await openRoute(page, "/prayer/session?depth=quick");
  await expect(page.locator(".focused-prayer-header")).toContainText("1 / 2");
  await page.getByRole("button", { name: "Prayed · Next" }).click();
  await expect(page.locator(".focused-prayer-header")).toContainText("2 / 2");
  const remaining = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("link", { name: "Exit & resume later" }).click(); await page.reload();
  await page.getByRole("link", { name: "Resume session", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(remaining);
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Session finished." })).toBeVisible();
});

test("collections can be renamed, reject collisions, and remove passages", async ({ page }) => {
  await openRoute(page, "/bible/collections?translation=BSB&start=JHN.3.16&end=JHN.3.16");
  await page.getByLabel("New collection").fill("Promises"); await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Add selected passage to Promises" }).click();
  await expect(page.getByRole("link", { name: "John 3:16", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Add selected passage to Promises" }).click();
  await expect(page.getByRole("link", { name: "John 3:16", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByLabel("Collection name", { exact: true }).fill("God’s promises");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByRole("heading", { name: "God’s promises", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "John 3:16", exact: true }).click();
  await expect(page.getByRole("button", { name: "Select John 3:16", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goBack(); await page.getByRole("button", { name: "Remove John 3:16" }).click();
  await expect(page.getByText(/No passages saved here yet/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Delete collection" }).click();
  await expect(page.getByRole("heading", { name: "No collections yet." })).toBeVisible();
});

test("search restores query and filters with browser back and opens exact verse", async ({ page }) => {
  await openRoute(page, "/search");
  await page.getByLabel("Search MDD").fill("Jn 3:16"); await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.locator(".search-hit").filter({ hasText: "John 3:16" }).click();
  await expect(page.getByRole("button", { name: "Select John 3:16", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goBack(); await expect(page.getByLabel("Search MDD")).toHaveValue("Jn 3:16");
  await page.getByLabel("Search MDD").fill("faith"); await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("combobox", { name: "Book", exact: true }).selectOption("ROM");
  await expect(page).toHaveURL(/book=ROM/);
  await page.goBack(); await expect(page.getByRole("combobox", { name: "Book", exact: true })).toHaveValue("");
  await page.goBack(); await expect(page.getByLabel("Search MDD")).toHaveValue("Jn 3:16");
});

test("encrypted backup restores in a fresh profile and failed/cancelled restores preserve data", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  await createPrayer(page, "Backup recovery preserves this prayer.", "DAILY");
  const encrypted = await backup(page, true);
  const clean = await browser.newContext({ serviceWorkers: "block", baseURL: "http://127.0.0.1:4173" });
  const fresh = await clean.newPage();
  try {
    await openRoute(fresh, "/data"); await upload(fresh, encrypted);
    await fresh.getByLabel("Backup password", { exact: false }).last().fill("incorrect-password");
    await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await expect(fresh.locator(".data-status")).toContainText("password is incorrect");
    await fresh.locator(".data-status").scrollIntoViewIfNeeded(); await fresh.screenshot({ path: testInfo.outputPath("restore-wrong-password.png") });
    await fresh.getByLabel("Backup password", { exact: false }).last().fill("test-only-backup-passphrase");
    await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await expect(fresh.locator(".data-status")).toContainText("Backup validated");
    await fresh.getByRole("radio", { name: "Replace", exact: true }).check();
    await expect(fresh.getByRole("button", { name: "Replace with validated backup" })).toBeDisabled();
    await fresh.locator(".data-status").scrollIntoViewIfNeeded(); await fresh.screenshot({ path: testInfo.outputPath("restore-confirmation.png") });
    await fresh.getByRole("button", { name: "Cancel restore" }).click();
    await expect(fresh.locator(".data-status")).toContainText("Restore cancelled");
    await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await fresh.getByRole("checkbox", { name: "I understand this replaces all current MDD data." }).check();
    await fresh.getByRole("button", { name: "Replace with validated backup" }).click();
    await expect(fresh.locator(".data-status")).toContainText("restored successfully");
    await fresh.locator(".data-status").scrollIntoViewIfNeeded(); await fresh.screenshot({ path: testInfo.outputPath("restore-success.png") });
    const before = JSON.parse(strFromU8(unzipSync(await backup(fresh))["data.json"]!));
    await upload(fresh, Buffer.from("not a backup")); await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await expect(fresh.locator(".data-status")).toContainText("not a valid");
    await fresh.locator(".data-status").scrollIntoViewIfNeeded(); await fresh.screenshot({ path: testInfo.outputPath("restore-corrupt-file.png") });
    const after = JSON.parse(strFromU8(unzipSync(await backup(fresh))["data.json"]!));
    expect(after).toEqual(before);
    await upload(fresh, encrypted); await fresh.getByLabel("Backup password", { exact: false }).last().fill("test-only-backup-passphrase");
    await fresh.getByRole("radio", { name: "Merge", exact: true }).check();
    await fresh.getByRole("button", { name: "Preview & validate" }).click();
    await fresh.getByRole("button", { name: "Merge validated backup" }).click();
    await expect(fresh.locator(".data-status")).toContainText("merged successfully");
    await openRoute(fresh, "/prayer"); await expect(fresh.locator(".prayer-live-row")).toHaveCount(1);
    await fresh.locator(".prayer-live-row").click(); await expect(fresh.locator(".prayer-admin-list")).toContainText("Daily");
    await openRoute(fresh, "/history/moments"); await expect(fresh.getByText("Backup recovery preserves this prayer.")).toBeVisible();
  } finally { await clean.close(); }
});

test("invalid, deleted and failed lazy routes have recoverable states", async ({ page }, testInfo) => {
  await openRoute(page, "/history/day/2026-02-30"); await expect(page.getByRole("heading", { name: "Invalid date" })).toBeVisible();
  await openRoute(page, "/prayer/removed/settings"); await expect(page.getByRole("heading", { name: "Prayer unavailable" })).toBeVisible();
  await page.getByRole("link", { name: "Return to Prayer" }).click(); await expectCanonicalTitle(page, "Prayer");
  await page.route("**/assets/CollectionsScreen-*.js", (route) => route.abort());
  await openRoute(page, "/bible/collections");
  await expect(page.getByRole("button", { name: "Reload MDD" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("lazy-route-recovery.png") });
  await page.unroute("**/assets/CollectionsScreen-*.js");
  await page.getByRole("button", { name: "Reload MDD" }).click();
  await expectRouteTitle(page, "Collections", "Scripture collections");
});

test("populated dark forms and Scripture remain accessible with long text", async ({ page }, testInfo) => {
  await createPrayer(page, "May we grow in patience. ".repeat(30));
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await page.getByLabel("Prayer update").fill("A little encouragement.");
  await page.screenshot({ path: testInfo.outputPath("long-prayer-dark.png"), fullPage: true });
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Add update", exact: true }).click();
  await expect(page.getByText("Update recorded.")).toBeVisible();
  await openRoute(page, "/bible/PSA/119?verse=105");
  await expect(page.getByRole("button", { name: "Select Psalms 119:105", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expectNoHorizontalOverflow(page); await expectNoAxeViolations(page);
});

test("large local history and prayer lists remain searchable and responsive", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await createPrayer(page, "Seed request for a large archive.");
  // Native IndexedDB is used only to construct this stress fixture; no test hooks ship in MDD.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((done, reject) => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => done(request.result); request.onerror = () => reject(request.error); });
    const original = await new Promise<any>((done) => { const request = database.transaction("prayers").objectStore("prayers").getAll(); request.onsuccess = () => done(request.result[0]); });
    await new Promise<void>((done, reject) => {
      const transaction = database.transaction(["prayers", "activityEvents"], "readwrite");
      for (let index = 1; index < 1000; index++) transaction.objectStore("prayers").put({ ...original, id: `stress-prayer-${index}`, body: index === 999 ? `Searchable-needle ${"long".repeat(100)}` : `Request ${index}: wisdom, peace and kindness for this week.` });
      for (let index = 0; index < 5000; index++) { const date = new Date(Date.now()-index*86400000); transaction.objectStore("activityEvents").put({ id: `stress-event-${index}`, type: "PRAYER_CREATED", localDate: date.toISOString().slice(0,10), occurredAt: date.toISOString(), timeZone: "UTC", subjectType: "prayer", subjectId: original.id, metadata: {} }); }
      transaction.oncomplete = () => done(); transaction.onerror = () => reject(transaction.error);
    }); database.close();
  });
  const start = Date.now(); await openRoute(page, "/prayer"); await expect(page.locator(".prayer-live-row")).toHaveCount(1000); const listMs = Date.now()-start;
  await page.screenshot({ path: testInfo.outputPath("large-prayer-list.png") });
  await expectNoHorizontalOverflow(page);
  const searchStart = Date.now(); await openRoute(page, "/search?q=Searchable-needle"); await expect(page.locator(".search-hit")).toHaveCount(1); const searchMs = Date.now()-searchStart;
  await expectNoHorizontalOverflow(page); await page.locator(".search-hit").click(); await expect(page.getByLabel("Request", { exact: true })).toContainText("Searchable-needle");
  const historyStart = Date.now(); await openRoute(page, "/history/moments"); await expect(page.locator(".moment-row")).toHaveCount(200); const historyMs = Date.now()-historyStart;
  await page.screenshot({ path: testInfo.outputPath("large-history.png") });
  await expectNoHorizontalOverflow(page);
  await testInfo.attach("large-archive-performance", { body: JSON.stringify({ prayers:1000, events:5000, listMs, searchMs, historyMs }), contentType: "application/json" });
});

test("weekday scheduling shows keyboard focus, selection, and readable validation", async ({ page }, testInfo) => {
  await openRoute(page, "/prayer/new");
  await page.getByLabel("What do you want to pray about?").fill("Give Anna peace and wisdom this week.");
  await page.getByRole("button", { name: "Add details", exact: true }).click();
  const schedule = page.getByRole("combobox", { name: "Schedule", exact: true });
  await schedule.selectOption("WEEKDAYS");
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.locator(".prayer-form-status")).toContainText("Choose at least one weekday");
  await page.screenshot({ path: testInfo.outputPath("weekday-validation.png"), fullPage: true });
  await schedule.focus(); await page.keyboard.press("Tab");
  const monday = page.getByRole("checkbox", { name: "Mon", exact: true });
  await expect(monday).toBeFocused();
  await expect(monday.locator("+ span")).toHaveCSS("outline-style", "solid");
  await expect(monday.locator("+ span")).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Space"); await expect(monday).toBeChecked();
  await expect(monday.locator("+ span .icon")).toBeVisible();
  await page.getByRole("checkbox", { name: "Sun", exact: true }).focus();
  await page.keyboard.press("Space");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("weekday-keyboard-selection-light.png"), fullPage: true });
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await monday.focus();
  await page.screenshot({ path: testInfo.outputPath("weekday-keyboard-selection-dark.png"), fullPage: true });
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.locator(".prayer-admin-list")).toContainText("Every Monday, Sunday");
  await page.reload(); await expect(page.locator(".prayer-admin-list")).toContainText("Every Monday, Sunday");
});

test("Scripture word boundaries remain readable in search and the reader", async ({ page }, testInfo) => {
  await openRoute(page, '/search?q=%22LORD%20and%20wait%22');
  const result = page.locator(".search-hit").filter({ hasText: "Psalms 37:7" });
  await expect(result).toContainText("the LORD and wait patiently");
  await page.screenshot({ path: testInfo.outputPath("search-poetry-word-boundaries.png") });
  await openRoute(page, "/bible/2PE/3?verse=9");
  await expect(page.locator(".scripture-copy")).toContainText("in keeping His promise");
  await page.screenshot({ path: testInfo.outputPath("reader-added-word-boundaries.png") });
});
