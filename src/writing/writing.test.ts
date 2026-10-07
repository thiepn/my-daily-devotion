import { afterEach, expect, it, vi } from "vitest";
import { MddDatabase } from "../data/database";
import { ReflectionConflictError, ReflectionRepository } from "../data/repositories/reflections";
import { PrayerRepository } from "../data/repositories/prayers";
import { buildReflectionUrl, buildPrayerHandoffUrl } from "../reflection/context";
import { buildPrayerFromScriptureUrl } from "../prayer/context";
import type { ScriptureReference } from "../domain/types";

const databases: MddDatabase[] = [];
function database() { const db = new MddDatabase("writing-" + crypto.randomUUID()); databases.push(db); return db; }
afterEach(async () => { vi.useRealTimers(); for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
const reference: ScriptureReference = { translationId: "BSB", startVerseKey: "JHN.3.16", endVerseKey: "JHN.3.18" };
it("returns the committed reflection and links without additional writes on read", async () => {
  const db = database(); const repo = new ReflectionRepository(db);
  const saved = await repo.saveDaily("2026-04-24", "Remember grace.", null, reference);
  expect(saved.links).toHaveLength(1); expect(saved.created).toBe(true);
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  await repo.getDaily("2026-04-24"); await repo.listScriptureLinks(saved.reflection.id);
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
  const edited = await repo.saveDaily("2026-04-24", "Remember His grace.", saved.reflection.revision, reference);
  expect(edited.links).toHaveLength(1); expect(await db.activityEvents.count()).toBe(1);
  expect(db.verno).toBe(2);
});
it("retains both versions on stale save and prevents stale deletion", async () => {
  const db = database(); const repo = new ReflectionRepository(db);
  const first = await repo.saveDaily("2026-04-24", "First.");
  const second = await repo.saveDaily("2026-04-24", "Other tab.", first.reflection.revision);
  await expect(repo.saveDaily("2026-04-24", "My writing.", first.reflection.revision)).rejects.toMatchObject({ name: "ReflectionConflictError", latest: second.reflection });
  await expect(repo.removeDaily("2026-04-24", first.reflection.revision)).rejects.toBeInstanceOf(ReflectionConflictError);
  expect((await repo.getDaily("2026-04-24"))?.bodyMd).toBe("Other tab.");
});
it("does not silently recreate a reflection removed in another tab", async () => {
  const db = database(); const repo = new ReflectionRepository(db);
  const saved = await repo.saveDaily("2026-04-24", "Saved.");
  await repo.removeDaily("2026-04-24", saved.reflection.revision);
  await expect(repo.saveDaily("2026-04-24", "Unsaved.", saved.reflection.revision)).rejects.toMatchObject({ latest: undefined });
  expect(await repo.getDaily("2026-04-24")).toBeUndefined();
});
it("rejects changed or deleted prayer sources atomically without new records", async () => {
  const db = database(); const repo = new ReflectionRepository(db); const prayers = new PrayerRepository(db);
  const saved = await repo.saveDaily("2026-04-24", "Saved.");
  await repo.removeDaily("2026-04-24");
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  await expect(prayers.createPrayer({ body: "Keep this request.", sourceReflectionId: saved.reflection.id, expectedSourceReflectionRevision: saved.reflection.revision, scriptureReferences: [reference], schedule: { mode: "DAILY" } })).rejects.toThrow("source reflection");
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});
it("preserves nested return URLs, exact Scripture and historical reflection date", async () => {
  const db = database(); const saved = await new ReflectionRepository(db).saveDaily("2024-02-29", "Leap day.");
  const origin = "/history/day/2024-02-29?entry=example&return=%2Fhistory%3Fperiod%3D2024%26shown%3D15";
  const reflection = buildReflectionUrl("2024-02-29", reference, origin);
  const handoff = new URLSearchParams(buildPrayerHandoffUrl(saved.reflection, reflection).split("?")[1]);
  expect(handoff.get("return")).toBe(reflection); expect(handoff.get("sourceDevotionDate")).toBe("2024-02-29");
  expect(buildReflectionUrl("2024-02-29", null, "//evil.example")).not.toContain("return");
  const capture = new URLSearchParams(buildPrayerFromScriptureUrl(reference, "/bible/JHN/3?verse=16&endVerse=18").split("?")[1]);
  expect(capture.get("start")).toBe(reference.startVerseKey); expect(capture.get("sourceDevotionDate")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
