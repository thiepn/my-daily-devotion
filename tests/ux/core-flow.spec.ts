import { expect, test } from "@playwright/test";
import { enrollCalendarPlan, openRoute, visibleNavLink } from "./helpers";

test.describe("core devotional journeys", () => {
  test("first-run setup reaches Scripture and returns with factual progress", async ({ page }) => {
    await enrollCalendarPlan(page);
    const reading = page.locator(".reading-passage").first();
    await expect(reading).toBeVisible();
    const reference = (await reading.innerText()).trim();
    await reading.click();
    await expect(page.getByRole("heading", { level: 1, name: "Bible" })).toBeVisible();
    await expect(page.getByText(reference, { exact: true }).first()).toBeVisible();
    const complete = page.getByRole("button", { name: "Mark reading complete" });
    await expect(complete).toBeVisible();
    await complete.click();
    await page.getByRole("link", { name: "Back to Today" }).click();
    await expect(page.getByText("1 of 4", { exact: true })).toBeVisible();
  });

  test("Scripture can become a reflection, prayer, and remembered history", async ({ page }) => {
    await openRoute(page, "/bible/JHN/3");
    await expect(page.getByRole("heading", { level: 2, name: "John 3" })).toBeVisible();
    await page.getByRole("button", { name: "Select John 3:16" }).click();
    await expect(page.getByRole("region", { name: "Actions for John 3:16" })).toBeVisible();
    await page.getByRole("button", { name: /Reflect/ }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Reflect" })).toBeVisible();
    const reflection = page.getByLabel("Daily reflection");
    await reflection.fill("God's love in John 3:16 should shape the way I pray for people today.");
    await page.getByRole("button", { name: "Save reflection" }).click();
    await expect(page.getByText(/Reflection (created and )?saved locally\./)).toBeVisible();
    await page.getByRole("link", { name: /Create prayer/ }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Add prayer" })).toBeVisible();
    await page.getByLabel("What do you want to pray about?").fill("Pray that I would love people sacrificially today.");
    await page.getByRole("button", { name: "Save prayer" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Prayer" })).toBeVisible();
    await page.getByRole("button", { name: "Prayed now" }).click();
    await expect(page.getByText("Prayed now recorded.")).toBeVisible();

    await visibleNavLink(page, "History").click();
    await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
    const today = page.locator(".history-day[href]").first();
    await expect(today).toBeVisible();
    await today.click();
    expect(await page.locator(".history-entry").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(/John 3:16/).first()).toBeVisible();
  });

  test("Scripture search and collections stay understandable without leaving the Bible domain", async ({ page }) => {
    await openRoute(page, "/bible/JHN/3");
    await page.getByRole("button", { name: "Select John 3:16" }).click();
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Add to collection" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Collections" })).toBeVisible();
    await page.getByLabel("New collection").fill("Promises");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.locator(".collection-add-here").visible().click();
    await expect(page.getByText("Passage added to collection.")).toBeVisible();
    await expect(page.getByRole("link", { name: "John 3:16" })).toBeVisible();

    await openRoute(page, "/search");
    await page.getByLabel("Search MDD").fill("John 3:16");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Scripture", level: 2 })).toBeVisible();
    await expect(page.getByText("John 3:16", { exact: true }).first()).toBeVisible();
  });
});
