import { afterEach, describe, expect, it, vi } from "vitest";
import { MddDatabase } from "../data/database";
import { PrayerRepository } from "../data/repositories/prayers";
import { PrayerSessionRepository } from "../data/repositories/prayer-sessions";
import type { Instant, LocalDate } from "../domain/types";
import { parsePrayerSessionContext, prayerSessionUrl, readSessionRequestContext, sessionPresentation, sessionReason } from "./session-context";

const databases: MddDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function setup(count = 3) {
  const db = new MddDatabase(`session-journal-${crypto.randomUUID()}`); databases.push(db);
  const prayers = new PrayerRepository(db), sessions = new PrayerSessionRepository(db);
  for (let i = 0; i < count; i++) await prayers.createPrayer({ body: `Request ${i}` });
  const state = (await sessions.startOrResume("quick", "2026-04-24" as LocalDate))!;
  return { db, prayers, sessions, state };
}
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(async table => [table.name, await table.toArray()])); }

describe("focused prayer journal safety", () => {
  it("reads without reconciliation and only explicit entry reconciles unavailable requests", async () => {
    const { db, prayers, sessions, state } = await setup();
    await prayers.transition(state.entries[0]!.prayer!.id, "WAITING");
    const before = await snapshot(db);
    const read = await sessions.readState(state.session.id);
    expect(read.entries[0]!.item.outcome).toBeNull();
    expect(await snapshot(db)).toEqual(before);
    const reconciled = await sessions.loadState(state.session.id);
    expect(reconciled.entries.map(e => e.item.outcome)).toEqual(["SKIP", null, null]);
    expect(await db.activityEvents.where("type").equals("PRAYER_PRAYED").count()).toBe(0);
  });
  it("returns the committed state and records a pending item only once under concurrent actions", async () => {
    const { db, sessions, state } = await setup(); const item = state.entries[0]!;
    const results = await Promise.allSettled([sessions.next(state.session.id, item.item.id), sessions.next(state.session.id, item.item.id)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const result = results.find(r => r.status === "fulfilled")!;
    if (result.status === "fulfilled") expect(result.value.state.entries[0]!.item.outcome).toBe("NEXT");
    expect(await db.activityEvents.where("type").equals("PRAYER_PRAYED").count()).toBe(1);
  });
  it("rejects stale prayer revisions and never recreates a deleted session", async () => {
    const { db, prayers, sessions, state } = await setup(); const entry = state.entries[0]!;
    await prayers.updateBody(entry.prayer!.id, "Changed elsewhere", entry.prayer!.revision);
    const before = await snapshot(db);
    await expect(sessions.next(state.session.id, entry.item.id, undefined, { prayer: entry.prayer!.revision })).rejects.toThrow(/another tab/);
    await expect(sessions.answer(state.session.id, entry.item.id, "My note", undefined, { prayer: entry.prayer!.revision })).rejects.toThrow(/another tab/);
    expect(await snapshot(db)).toEqual(before);
    await db.prayerSessions.update(state.session.id, { deletedAt: "2026-04-24T08:00:00Z" as Instant, revision: 2 });
    const removed = await snapshot(db); expect(await sessions.endSession(state.session.id)).toBeNull();
    await expect(sessions.loadState(state.session.id)).rejects.toThrow(/no longer available/);
    expect(await snapshot(db)).toEqual(removed);
  });
  it("continues the identified queue across midnight and leaves ended sessions unchanged", async () => {
    const { db, sessions, state } = await setup();
    const next = await sessions.next(state.session.id, state.entries[0]!.item.id, "2026-04-25T07:00:00Z" as Instant);
    expect(next.state.session.localDate).toBe("2026-04-24");
    expect((await db.activityEvents.where("type").equals("PRAYER_PRAYED").first())?.localDate).toBe("2026-04-24");
    const ended = await sessions.endSession(state.session.id); expect(sessionPresentation(ended!.state).closed).toBe("ended");
    const before = await snapshot(db); await sessions.loadState(state.session.id); expect(await snapshot(db)).toEqual(before);
  });
  it("keeps Skip and Answer distinct and finishes automatically without a prayed event", async () => {
    const { db, sessions, state } = await setup(2);
    await sessions.skip(state.session.id, state.entries[0]!.item.id);
    const answer = await sessions.answer(state.session.id, state.entries[1]!.item.id, null);
    expect(sessionPresentation(answer.state).closed).toBe("finished");
    expect(await db.activityEvents.where("type").equals("PRAYER_PRAYED").count()).toBe(0);
    expect(await db.prayerResolutions.count()).toBe(1);
    expect(answer.state.entries.every(e => e.prayer?.lastPrayedAt === null)).toBe(true);
  });
  it("keeps creation reasons transient and hides tombstoned context", async () => {
    const { db, prayers, sessions, state } = await setup(1); const id = state.entries[0]!.prayer!.id;
    expect(sessionReason(state.reasons?.[state.entries[0]!.item.id])).toMatch(/not prayed/);
    expect((await sessions.readState(state.session.id)).reasons).toBeUndefined();
    expect(sessionReason()).toBe("Part of your saved session.");
    await prayers.addUpdate(id, "Private encouragement", "encouragement");
    await prayers.removePrayer(id);
    const before = await snapshot(db); expect(await readSessionRequestContext(db, id)).toEqual({ latest: null, links: [] });
    expect(await snapshot(db)).toEqual(before);
  });
  it("rolls back every reconciliation change when any item write fails", async () => {
    const { db, prayers, sessions, state } = await setup(2);
    for (const entry of state.entries) await prayers.transition(entry.prayer!.id, "WAITING");
    const before = await snapshot(db), original = db.prayerSessionItems.put.bind(db.prayerSessionItems);
    let writes = 0;
    const spy = vi.spyOn(db.prayerSessionItems, "put").mockImplementation((...args: Parameters<typeof original>) => {
      if (++writes === 2) throw new Error("Storage interrupted");
      return original(...args);
    });
    await expect(sessions.loadState(state.session.id)).rejects.toThrow("Storage interrupted"); spy.mockRestore();
    expect(await snapshot(db)).toEqual(before);
  });
  it("finishes after the last valid request and reconciles only unavailable pending items", async () => {
    const { db, prayers, sessions, state } = await setup(3);
    await prayers.transition(state.entries[1]!.prayer!.id, "WAITING"); await prayers.removePrayer(state.entries[2]!.prayer!.id);
    expect(sessionPresentation(await sessions.readState(state.session.id)).last).toBe(true);
    const result = await sessions.next(state.session.id, state.entries[0]!.item.id);
    expect(sessionPresentation(result.state).closed).toBe("finished"); expect(result.state.entries.map(entry => entry.item.outcome)).toEqual(["NEXT", "SKIP", "SKIP"]);
    expect(await db.activityEvents.where("type").equals("PRAYER_PRAYED").count()).toBe(1);
  });
  it("validates session identity without falling back to creation and keeps nested return URLs", () => {
    expect(parsePrayerSessionContext("?session=&depth=unknown&return=https://example.com")).toEqual({ sessionId: null, invalidSession: true, depth: "quick", returnTo: "/prayer", draftId:null });
    const origin = "/prayer?status=ACTIVE&person=friend&category=family";
    const url = prayerSessionUrl({ sessionId: "saved-session", returnTo: origin });
    expect(parsePrayerSessionContext(url.slice(url.indexOf("?")))).toEqual({ sessionId: "saved-session", invalidSession: false, depth: "quick", returnTo: origin, draftId:null });
    const draftId="00000000-0000-4000-8000-000000009999";
    expect(parsePrayerSessionContext(prayerSessionUrl({sessionId:"saved-session",returnTo:origin,draftId}).split("?")[1]!).draftId).toBe(draftId);
    expect(parsePrayerSessionContext("?session=saved-session&draft=malformed").draftId).toBeNull();
  });
});
