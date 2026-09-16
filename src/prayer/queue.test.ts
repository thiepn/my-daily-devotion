import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";
import type { Instant, LocalDate } from "../domain/types";
import { PrayerQueueService } from "./queue";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-queue-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
const date = "2026-09-16" as LocalDate;

describe("PrayerQueueService", () => {
  it("builds the four precedence bands deterministically and deduplicates between them", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const queue = new PrayerQueueService(database);
    const focus = await prayers.createPrayer({ body: "Focus", focusUntil: date });
    const due = await prayers.createPrayer({ body: "Daily", schedule: { mode: "DAILY" } });
    const never = await prayers.createPrayer({ body: "New rotation" });
    const rotation = await prayers.createPrayer({ body: "Old rotation" });
    await prayers.markPrayed(focus.id, "2026-09-15T08:00:00.000Z" as Instant);
    await prayers.markPrayed(due.id, "2026-09-15T08:00:00.000Z" as Instant);
    await prayers.markPrayed(rotation.id, "2026-09-01T08:00:00.000Z" as Instant);
    const result = await queue.build(date, 4);
    expect(result.map((entry) => entry.band)).toEqual(["FOCUS_OR_EVENT", "FIXED_DUE", "NEVER_PRAYED", "ROTATION"]);
    expect(result.map((entry) => entry.prayer.body)).toEqual(["Focus", "Daily", "New rotation", "Old rotation"]);
  });

  it("never auto-surfaces manual-only prayers and does not turn missed fixed dates into debt", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const queue = new PrayerQueueService(database);
    await prayers.createPrayer({ body: "Manual", schedule: { mode: "MANUAL_ONLY" } });
    const once = await prayers.createPrayer({ body: "Yesterday only", schedule: { mode: "ON_DATE", onDate: "2026-09-15" } });
    await prayers.markPrayed(once.id, "2026-09-15T08:00:00.000Z" as Instant);
    expect((await queue.build(date, 10)).map((entry) => entry.prayer.body)).not.toContain("Manual");
    expect((await queue.build(date, 10)).map((entry) => entry.prayer.body)).not.toContain("Yesterday only");
  });

  it("keeps all genuinely due priority prayers even when they exceed the chosen depth target", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const queue = new PrayerQueueService(database);
    for (let index = 0; index < 6; index += 1) {
      const prayer = await prayers.createPrayer({ body: `Daily ${index}`, schedule: { mode: "DAILY" } });
      await prayers.markPrayed(prayer.id, `2026-09-15T08:00:0${index}.000Z` as Instant);
    }
    const result = await queue.build(date, 4);
    expect(result).toHaveLength(6);
    expect(result.every((entry) => entry.band === "FIXED_DUE")).toBe(true);
  });

  it("excludes waiting, answered and archived prayers regardless of schedule", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const queue = new PrayerQueueService(database);
    const waiting = await prayers.createPrayer({ body: "Waiting due", schedule: { mode: "DAILY" } });
    const answered = await prayers.createPrayer({ body: "Answered due", schedule: { mode: "DAILY" } });
    const archived = await prayers.createPrayer({ body: "Archived due", schedule: { mode: "DAILY" } });
    await prayers.transition(waiting.id, "WAITING"); await prayers.answer(answered.id); await prayers.transition(archived.id, "ARCHIVED");
    expect((await queue.build(date, 20)).map((entry) => entry.prayer.body)).toEqual([]);
  });
});
