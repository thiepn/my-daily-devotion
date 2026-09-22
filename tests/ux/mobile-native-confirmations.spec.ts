import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoHorizontalOverflow, openRoute } from "./helpers";

async function addPerson(page: Page, name: string) {
  await openRoute(page, "/prayer/people");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add person", exact: true }).click();
  const row = page.locator(".metadata-row").filter({ hasText: name });
  await expect(row).toBeVisible();
  return row;
}

async function createScheduledPrayer(page: Page, body: string) {
  await openRoute(page, "/prayer/new");
  await page.getByLabel("What do you want to pray about?").fill(body);
  await page.getByRole("button", { name: "Add details", exact: true }).click();
  await page.getByRole("combobox", { name: "Schedule", exact: true }).selectOption("DAILY");
  await page.getByRole("button", { name: "Save prayer", exact: true }).click();
  await expect(page.getByLabel("Request", { exact: true })).toHaveValue(body);
}

test.describe("native in-app confirmations", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("unsaved internal navigation uses an app bottom sheet, not browser confirm", async ({ page }) => {
    const browserDialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      browserDialogs.push(dialog.type());
      await dialog.dismiss();
    });

    await openRoute(page, "/today/reflection/2026-09-22");
    await page.getByLabel("Daily reflection").fill("Keep this local draft.");
    await page.getByRole("button", { name: "Back", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep editing", exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(380);
    expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 844)).toBeLessThanOrEqual(2);
    expect(browserDialogs).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Daily reflection")).toHaveValue("Keep this local draft.");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Leave without saving", exact: true }).click();
    await expect(page).toHaveURL(/#\/today$/);
    expect(browserDialogs).toEqual([]);
  });

  test("destructive confirmation defaults to the safe action and respects cancel", async ({ page }) => {
    const row = await addPerson(page, "Anna");
    const remove = row.getByRole("button", { name: "Remove", exact: true });
    await remove.click();

    const dialog = page.getByRole("dialog", { name: "Remove person?" });
    await expect(dialog).toBeVisible();
    const keep = dialog.getByRole("button", { name: "Keep person", exact: true });
    const accept = dialog.getByRole("button", { name: "Remove person", exact: true });
    await expect(keep).toBeFocused();

    for (const button of [keep, accept]) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await keep.click();
    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();
    await expect(remove).toBeEnabled();

    await remove.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove person", exact: true }).click();
    await expect(row).toHaveCount(0);
  });

  test("Focused Prayer protects an answer draft with the same app confirmation", async ({ page }) => {
    await createScheduledPrayer(page, "Give us patience today.");
    await openRoute(page, "/prayer/session?depth=quick");
    await page.getByRole("button", { name: "Answered", exact: true }).click();
    const answer = page.getByLabel("What happened?");
    await answer.fill("An answer I have not saved yet.");

    await page.getByRole("button", { name: "Skip", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Discard answer note?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep writing", exact: true }).click();
    await expect(answer).toHaveValue("An answer I have not saved yet.");

    await page.getByRole("button", { name: "End session", exact: true }).click();
    const endDialog = page.getByRole("dialog", { name: "End session and discard note?" });
    await expect(endDialog).toBeVisible();
    await endDialog.getByRole("button", { name: "Keep writing", exact: true }).click();
    await expect(answer).toHaveValue("An answer I have not saved yet.");
  });

  test("confirmation sheet reflows at 320px and 200 percent text", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }));

    const row = await addPerson(page, "Narrow-screen person");
    await row.getByRole("button", { name: "Remove", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Remove person?" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(310);
    for (const name of ["Keep person", "Remove person"]) {
      const buttonBox = await dialog.getByRole("button", { name, exact: true }).boundingBox();
      expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("desktop keeps a centered confirmation dialog", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const row = await addPerson(page, "Desktop person");
    await row.getByRole("button", { name: "Remove", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Remove person?" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? Infinity).toBeLessThan(620);
    expect(box?.x ?? 0).toBeGreaterThan(250);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(860);
  });
});
