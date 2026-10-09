import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import { PrayerRepository } from "../data/repositories/prayers";
import { HistoryRepository } from "./repository";
import type { Instant, LocalDate } from "../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-history-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

describe("HistoryRepository", () => {
  it("keeps a factual event after removal without resurfacing deleted private text or dead links", async () => {
    const database = testDb(); await prepareDatabase(database);
    const prayers = new PrayerRepository(database); const prayer = await prayers.createPrayer({ body: "Private removed prayer" });
    await prayers.answer(prayer.id, "Private removed answer"); await prayers.removePrayer(prayer.id);
    const reflections = new ReflectionRepository(database); await reflections.saveDaily("2026-09-17", "Private removed reflection"); await reflections.removeDaily("2026-09-17");
    const moments = await new HistoryRepository(database).listMoments();
    expect(moments).toHaveLength(3);
    expect(moments.every((entry) => entry.body === null && entry.href === null)).toBe(true);
    expect(moments.map((entry) => entry.title).sort()).toEqual(["Added a prayer request", "Answered prayer", "Reflection written"]);
    expect(moments.every((entry) => entry.availability === "removed")).toBe(true);
  });
  it("groups meaningful activity by local date without precreating empty days", async () => {
    const database = testDb(); await prepareDatabase(database);
    await new ReflectionRepository(database).saveDaily("2026-09-16" as LocalDate, "Grace stood out today.");
    const history = new HistoryRepository(database);
    const summaries = await history.listDaySummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ localDate: "2026-09-16", total: 1, counts: { REFLECTION_CREATED: 1 } });
  });

  it("resolves reflection and answered-prayer moments back to source records", async () => {
    const database = testDb(); await prepareDatabase(database);
    await new ReflectionRepository(database).saveDaily("2026-09-16" as LocalDate, "Faithfulness in a difficult season.");
    const prayers = new PrayerRepository(database);
    const prayer = await prayers.createPrayer({ body: "Wisdom for an important decision" });
    await prayers.answer(prayer.id, "The direction became clear.", "2026-09-16T20:00:00.000Z" as Instant);
    const history = new HistoryRepository(database);
    const moments = await history.listMoments();
    expect(moments.some((item) => item.kind === "reflection" && item.body?.includes("Faithfulness"))).toBe(true);
    expect(moments.some((item) => item.kind === "answer" && item.body?.includes("direction became clear"))).toBe(true);
  });

  it("summarizes PRAYER_PRAYED as history without turning it into a completion score", async () => {
    const database = testDb(); await prepareDatabase(database);
    const prayers = new PrayerRepository(database); const prayer = await prayers.createPrayer({ body: "Pray for the church" });
    await prayers.markPrayed(prayer.id, "2026-09-16T18:00:00.000Z" as Instant);
    const history = new HistoryRepository(database); const day = await history.listDay((await database.activityEvents.toArray()).find((item) => item.type === "PRAYER_PRAYED")!.localDate);
    expect(day.some((item) => item.eventType === "PRAYER_PRAYED" && item.title === "Prayer prayed")).toBe(true);
  });
});
