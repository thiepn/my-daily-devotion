import { expect, test, type Page } from "@playwright/test";
import { openRoute, expectNoAxeViolations, expectNoHorizontalOverflow } from "./helpers";
import { writingSnapshot } from "./writing-fixture";
const route = "/bible/JHN/3?verse=16&endVerse=18&return=%2Fhistory%3Fshown%3D15";
async function openNote(page: Page) { await openRoute(page, route); await expect(page.getByRole("button", { name: "Select John 3:18", exact: true })).toHaveAttribute("aria-pressed", "true"); await page.getByRole("button", { name: "Add verse note", exact: true }).click(); await expect(page.getByLabel("Verse note", { exact: true })).toBeVisible(); }
async function noteData(page: Page) { return Object.fromEntries((await writingSnapshot(page)).filter((row: any) => ["verseNotes", "editorDrafts", "editorDraftContents", "activityEvents"].includes(row[0])) as any); }
async function recover(page: Page) { await page.getByText("Kept drafts for this editor", { exact: true }).click(); await page.getByRole("button", { name: /Review kept draft/ }).click(); await page.getByRole("button", { name: "Recover for review" }).click(); }
test("pristine note opening is write-free and acknowledged notes recover explicitly after restart", async ({ page }) => {
  await openNote(page); const before = await noteData(page); await page.getByLabel("Verse note", { exact: true }).focus(); expect(await noteData(page)).toEqual(before);
  await page.getByLabel("Verse note", { exact: true }).fill("Keep my writing on this passage."); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  expect((await noteData(page)).verseNotes).toHaveLength(0); expect((await noteData(page)).activityEvents).toHaveLength(0);
  await page.reload(); await page.getByRole("button", { name: "Add verse note", exact: true }).click(); await expect(page.getByLabel("Verse note", { exact: true })).toBeEmpty();
  await recover(page); await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("Keep my writing on this passage.");
  await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  const after = await noteData(page); expect(after.verseNotes).toEqual([expect.objectContaining({ bodyMd: "Keep my writing on this passage.", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.18", revision: 1 })]); expect(after.activityEvents).toHaveLength(0);
  await expectNoAxeViolations(page); await expectNoHorizontalOverflow(page);
});
test("selection and close await explicit discard without recording notes", async ({ page }) => {
  await openNote(page); await page.getByLabel("Verse note", { exact: true }).fill("Discard only this editor’s writing."); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.getByRole("button", { name: "Clear verse selection" }).click(); await page.getByRole("button", { name: "Keep editing" }).click(); await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("Discard only this editor’s writing.");
  await page.getByRole("button", { name: "Clear verse selection" }).click(); await page.getByRole("button", { name: "Discard and continue" }).click(); await expect(page.locator(".verse-action-dock")).toHaveCount(0);
  const after = await noteData(page); expect(after.verseNotes).toHaveLength(0); expect(after.activityEvents).toHaveLength(0); expect(after.editorDraftContents).toHaveLength(0); expect(after.editorDrafts[0].state).toBe("discarded");
});
test("private storage failure does not block one explicit note save", async ({ page }) => {
  await openNote(page); await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (...args) { if (this.name === "editorDraftContents") throw new DOMException("Draft storage unavailable", "QuotaExceededError"); return put.apply(this, args); }; });
  await page.getByLabel("Verse note", { exact: true }).fill("Save this note explicitly."); await expect(page.getByRole("alert")).toContainText("Draft could not be kept");
  await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  expect((await noteData(page)).verseNotes).toHaveLength(1); expect((await noteData(page)).activityEvents).toHaveLength(0);
});
test("concurrent note changes require comparison and removal cannot recreate the target", async ({ page, context }) => {
  await openNote(page); await page.getByLabel("Verse note", { exact: true }).fill("Original saved note."); await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  await page.getByLabel("Verse note", { exact: true }).fill("My private changes."); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  const other = await context.newPage(); await openRoute(other, route); await other.getByRole("button", { name: "Edit verse note", exact: true }).click(); await other.getByLabel("Verse note", { exact: true }).fill("Saved elsewhere."); await other.getByRole("button", { name: "Save note", exact: true }).click(); await expect(other.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  await expect(page.getByRole("region", { name: "Verse note conflict" })).toBeVisible(); await expect(page.getByLabel("Your changes", { exact: true })).toHaveValue("My private changes."); await expect(page.getByLabel("Saved version", { exact: true })).toHaveValue("Saved elsewhere.");
  await page.getByRole("button", { name: "Keep my writing for the next save" }).click(); await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  await other.getByRole("button", { name: "Remove note", exact: true }).click(); await other.getByRole("dialog").getByRole("button", { name: "Remove note", exact: true }).click(); await expect(other.locator(".verse-note-editor")).toHaveCount(0);
  await expect(page.getByText("This saved note was removed.", { exact: false })).toBeVisible(); await expect(page.getByRole("button", { name: "Save note", exact: true })).toBeDisabled(); expect((await noteData(page)).verseNotes[0].deletedAt).not.toBeNull(); await other.close();
});

test("Recovery preserves a cross-chapter range and its complete return context without implicit saving", async ({ page }) => {
  const ranged = "/bible/JHN/3?translation=BSB&start=JHN.3.35&end=JHN.4.2&verse=35&return=%2Fhistory%2Fday%2F2026-04-24%3Fentry%3Dselected";
  await openRoute(page, ranged); await page.getByRole("button", { name: "Add verse note", exact: true }).click();
  await page.getByLabel("Verse note", { exact: true }).fill("A thought spanning two chapters."); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.goto("/#/recovery"); await page.getByRole("link", { name: /Verse note/ }).click();
  const before = await noteData(page); await page.getByRole("link", { name: "Review in Bible", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Review kept writing" })).toBeVisible(); expect(await noteData(page)).toEqual(before);
  await page.getByRole("button", { name: "Recover for review", exact: true }).click(); await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("A thought spanning two chapters.");
  await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally");
  const rows = await noteData(page); expect(rows.verseNotes[0]).toMatchObject({ startVerseKey: "JHN.3.35", endVerseKey: "JHN.4.2", revision: 1 }); expect(rows.activityEvents).toHaveLength(0);
  expect(rows.editorDrafts.every((draft: any) => draft.context.returnTo.includes("entry%3Dselected"))).toBe(true);
});

test("queued typing during note commitment remains unsaved and never repeats the earlier save", async ({ page }) => {
  await openNote(page); await page.getByLabel("Verse note", { exact: true }).fill("Submitted note."); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => { const request = indexedDB.open("my-daily-devotion"); request.onsuccess = () => resolve(request.result); });
    const transaction = database.transaction("verseNotes", "readwrite"); (window as any).releaseNoteLock = false;
    const keep = () => { const request = transaction.objectStore("verseNotes").get("unused"); request.onsuccess = () => { if (!(window as any).releaseNoteLock) keep(); }; }; keep(); transaction.oncomplete = () => database.close();
  });
  await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.getByLabel("Verse note", { exact: true })).toHaveAttribute("readonly", "");
  await page.getByLabel("Verse note", { exact: true }).evaluate((node: HTMLTextAreaElement) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, "Submitted note. Newer writing."); node.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.evaluate(() => { (window as any).releaseNoteLock = true; }); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("newer writing");
  await expect(page.getByLabel("Verse note", { exact: true })).toHaveValue("Submitted note. Newer writing."); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  const rows = await noteData(page); expect(rows.verseNotes).toEqual([expect.objectContaining({ bodyMd: "Submitted note.", revision: 1 })]); expect(rows.editorDraftContents[0].payload).toMatchObject({ bodyMd: "Submitted note. Newer writing.", baseline: { revision: 1 } }); expect(rows.activityEvents).toHaveLength(0);
});

test("a fresh selection replaces linked-range context and composition preserves the cursor", async ({ page }) => {
  await openRoute(page, "/bible/JHN/3?translation=BSB&start=JHN.3.35&end=JHN.4.2&verse=35");
  await expect(page.getByRole("button", { name: "Select John 3:35", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Select John 3:36", exact: true }).click(); await page.getByRole("button", { name: "Add verse note", exact: true }).click();
  const field = page.getByLabel("Verse note", { exact: true });
  await field.evaluate((node: HTMLTextAreaElement) => { node.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, "祈りと希望"); node.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true })); node.setSelectionRange(3, 3); node.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "祈りと希望" })); });
  await expect(field).toHaveValue("祈りと希望"); await expect(page.locator(".draft-status")).toHaveText("Draft kept on this device");
  expect(await field.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe(3);
  const before = await noteData(page); expect(before.editorDraftContents[0].payload.reference).toMatchObject({ startVerseKey: "JHN.3.35", endVerseKey: "JHN.3.36" }); expect(before.verseNotes).toHaveLength(0);
  await page.getByRole("button", { name: "Save note", exact: true }).click(); await expect(page.locator(".verse-note-editor .reader-status")).toContainText("saved locally"); expect((await noteData(page)).verseNotes[0]).toMatchObject({ bodyMd: "祈りと希望", endVerseKey: "JHN.3.36" });
});
