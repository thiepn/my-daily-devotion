import { expect, test } from "@playwright/test";
import { seedPrayerDetail } from "./prayer-detail-fixture";
import { openRoute } from "./helpers";
import { writingSnapshot } from "./writing-fixture";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-04-24T07:00:00+02:00"));
});
async function recorded(page: import("@playwright/test").Page, type: string) {
  const rows = await writingSnapshot(page);
  const events = rows.find(row => row[0] === "activityEvents")?.[1] as Array<{type: string}> | undefined;
  return events?.filter(row => row.type === type).length ?? 0;
}

test("Prayed now keeps unsaved update until the user explicitly chooses; save then prayed records each action only once", async ({ page }) => {
  await seedPrayerDetail(page);
  await page.getByRole("button", { name: "Add update", exact: true }).click();
  const field = page.getByLabel("Prayer update");
  await field.fill("A personal update must never vanish when marking prayed.");
  const button = page.getByRole("button", { name: "Prayed now", exact: true });
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Keep your unsaved changes?" });
  await expect(dialog).toBeVisible();
  await expect(field).toHaveValue("A personal update must never vanish when marking prayed.");
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(0);
  expect(await recorded(page, "PRAYER_UPDATED")).toBe(0);

  await dialog.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(field).toHaveValue("A personal update must never vanish when marking prayed.");
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(0);

  await button.click();
  await dialog.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(page.locator(".prayer-story-entry").first()).toContainText("A personal update must never vanish");
  await expect(page.getByText("Prayed now recorded.")).toBeVisible();
  expect(await recorded(page, "PRAYER_UPDATED")).toBe(1);
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(1);
});

test("Prayed now can discard unfinished wording only after user confirmation, without saving accidental changes", async ({ page }) => {
  await seedPrayerDetail(page);
  const original = await page.locator(".prayer-request-text").innerText();
  await page.getByRole("button", { name: "Edit wording", exact: true }).click();
  await page.getByLabel("Request", { exact: true }).fill("This private wording should not be committed.");
  await page.getByRole("button", { name: "Prayed now", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Keep your unsaved changes?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard and continue", exact: true }).click();
  await expect(page.locator(".prayer-request-text")).toHaveText(original);
  await expect(page.getByText("Prayed now recorded.")).toBeVisible();
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(1);
  const prayer = (await writingSnapshot(page)).find(row => row[0] === "prayers")?.[1] as Array<{body: string}>;
  expect(prayer[0]?.body).toBe(original);
});

test("marking prayed with no active edits keeps the ordinary one-click behavior", async ({ page }) => {
  await seedPrayerDetail(page);
  await page.getByRole("button", { name: "Prayed now", exact: true }).click();
  await expect(page.getByText("Prayed now recorded.")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Keep your unsaved changes?" })).toHaveCount(0);
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(1);
});

test("returning from a prayer detail never loops to its own route or an invalid target", async ({ page }) => {
  await seedPrayerDetail(page);
  const id = "00000000-0000-4000-8000-000000008001";
  for (const destination of ["/prayer/" + id, "/unknown", "/%2Fevil.invalid"]) {
    await openRoute(page, "/prayer/" + id + "?return=" + encodeURIComponent(destination));
    await expect(page.locator(".journal-heading .quiet-back-link")).toHaveAttribute("href", /#\/prayer$/);
    await page.locator(".journal-heading .quiet-back-link").click();
    await expect(page).toHaveURL(/#\/prayer$/);
  }
  await openRoute(page, "/prayer/" + id + "?return=" + encodeURIComponent("/history/day/2026-04-24?shown=20"));
  await expect(page.locator(".journal-heading .quiet-back-link")).toHaveAttribute("href", /#\/history\/day\/2026-04-24\?shown=20$/);
});

test("an unfinished answer cannot be recorded indirectly by Prayed now", async ({ page }) => {
  await seedPrayerDetail(page);
  await page.locator(".prayer-record-actions").getByRole("button", { name: "Mark answered", exact: true }).click();
  const note = page.getByLabel("What happened?", { exact: false });
  await note.fill("This answer has not happened.");
  await page.getByRole("button", { name: "Prayed now", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Keep your unsaved changes?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save and continue" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(note).toHaveValue("This answer has not happened.");
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(0);
  expect(await recorded(page, "PRAYER_ANSWERED")).toBe(0);
});

test("rapid unguarded Prayed now clicks are serialized into one devotional event", async ({ page }) => {
  await seedPrayerDetail(page);
  await page.getByRole("button", { name: "Prayed now", exact: true }).evaluate((button: HTMLButtonElement) => {
    button.click(); button.click();
  });
  await expect(page.getByText("Prayed now recorded.")).toBeVisible();
  expect(await recorded(page, "PRAYER_PRAYED")).toBe(1);
});
