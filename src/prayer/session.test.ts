import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { PrayerSessionRepository } from "../data/repositories/prayer-sessions";
import { PrayerRepository } from "../data/repositories/prayers";
import type { Instant, LocalDate } from "../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-session-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
const date = "2026-09-16" as LocalDate;

describe("persistent prayer sessions", () => {
  it("persists a frozen queue, resumes it, and keeps Next distinct from Skip", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const sessions = new PrayerSessionRepository(database);
    await prayers.createPrayer({ body: "One" }); await prayers.createPrayer({ body: "Two" }); await prayers.createPrayer({ body: "Three" });
    const state = await sessions.startOrResume("quick", date, "2026-09-16T18:00:00.000Z" as Instant);
    expect(state?.entries).toHaveLength(3);
    const first = state!.entries[0]!; const second = state!.entries[1]!;
    await sessions.next(state!.session.id, first.item.id, "2026-09-16T18:01:00.000Z" as Instant);
    await sessions.skip(state!.session.id, second.item.id, "2026-09-16T18:02:00.000Z" as Instant);
    const resumed = await sessions.startOrResume("extended", date, "2026-09-16T18:03:00.000Z" as Instant);
    expect(resumed?.session.id).toBe(state!.session.id);
    expect(resumed?.session.depth).toBe("quick");
    expect((await prayers.get(first.item.prayerId))?.lastPrayedAt).toBe("2026-09-16T18:01:00.000Z");
    expect((await prayers.get(second.item.prayerId))?.lastPrayedAt).toBeNull();
    expect(resumed?.entries.map((entry) => entry.item.outcome)).toEqual(["NEXT", "SKIP", null]);
  });

  it("closes an unfinished prior-date session rather than carrying stale due rules across midnight", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const sessions = new PrayerSessionRepository(database);
    await prayers.createPrayer({ body: "Daily", schedule: { mode: "DAILY" } });
    const first = await sessions.startOrResume("quick", date, "2026-09-16T22:00:00.000Z" as Instant);
    const nextDate = "2026-09-17" as LocalDate;
    const second = await sessions.startOrResume("quick", nextDate, "2026-09-17T06:00:00.000Z" as Instant);
    expect(second?.session.id).not.toBe(first?.session.id);
    expect((await database.prayerSessions.get(first!.session.id))?.endedAt).toBe("2026-09-17T06:00:00.000Z");
  });

  it("reconciles a prayer answered outside the session so resume cannot surface stale work", async () => {
    const database = testDb(); await prepareDatabase(database); const prayers = new PrayerRepository(database); const sessions = new PrayerSessionRepository(database);
    const prayer = await prayers.createPrayer({ body: "Request" });
    const state = await sessions.startOrResume("quick", date);
    await prayers.answer(prayer.id, "Answered elsewhere");
    const resumed = await sessions.loadState(state!.session.id);
    expect(resumed.entries[0]?.item.outcome).toBe("ANSWERED");
    expect(resumed.session.endedAt).not.toBeNull();
  });
});
