import { createId, newMutableFields, nowInstant } from "../../domain/identity";
import { currentTimeZone, todayLocalDate } from "../../domain/time";
import type { ActivityEvent, Instant, LocalDate, Prayer, PrayerSession, PrayerSessionItem, UUID } from "../../domain/types";
import { PrayerQueueService } from "../../prayer/queue";
import type { MddDatabase } from "../database";
import { PrayerRepository } from "./prayers";
import { assertExpectedRevision } from "../conflicts";

export const PRAYER_DEPTH_TARGETS = { quick: 4, regular: 10, extended: 20 } as const;
export type PrayerDepth = keyof typeof PRAYER_DEPTH_TARGETS;

export interface PrayerSessionEntry { item: PrayerSessionItem; prayer: Prayer | null; }
export interface PrayerSessionState {
  session: PrayerSession;
  entries: PrayerSessionEntry[];
  /** Creation-time queue reasons are presentation-only, never persisted. */
  reasons?: Record<string, string>;
}
export interface SessionExpectedRevisions { session?: number; item?: number; prayer?: number; }
export interface SessionActionResult {
  state: PrayerSessionState;
  action: "NEXT" | "SKIP" | "ANSWERED" | "ENDED";
  itemId?: UUID;
}
export class PrayerSessionUnavailableError extends Error {
  constructor() { super("This prayer session is no longer available."); this.name = "PrayerSessionUnavailableError"; }
}

export class PrayerSessionRepository {
  private readonly queue: PrayerQueueService;
  private readonly prayers: PrayerRepository;

  constructor(private readonly database: MddDatabase) {
    this.queue = new PrayerQueueService(database);
    this.prayers = new PrayerRepository(database);
  }

  async getOpenSession(): Promise<PrayerSession | undefined> {
    const sessions = await this.database.prayerSessions.filter((item) => item.deletedAt === null && item.endedAt === null).toArray();
    return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id))[0];
  }

  async startOrResume(depth: PrayerDepth, localDate: LocalDate = todayLocalDate(), at: Instant = nowInstant()): Promise<PrayerSessionState | null> {
    return this.database.transaction(
      "rw",
      [this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers, this.database.prayerSchedules],
      async () => {
        const open = await this.getOpenSession();
        if (open?.localDate === localDate) return this.loadStateInternal(open.id, true);
        if (open) await this.endSession(open.id, at);

        const queue = await this.queue.build(localDate, PRAYER_DEPTH_TARGETS[depth]);
        if (!queue.length) return null;
        const session: PrayerSession = { ...newMutableFields(at), localDate, startedAt: at, endedAt: null, depth };
        const items: PrayerSessionItem[] = queue.map((entry, position) => ({
          ...newMutableFields(at), sessionId: session.id, prayerId: entry.prayer.id, position, surfacedAt: at, outcome: null, actedAt: null,
        }));
        await this.database.prayerSessions.add(session);
        await this.database.prayerSessionItems.bulkAdd(items);
        return { ...await this.loadStateInternal(session.id, false), reasons: Object.fromEntries(items.map((item, index) => [item.id, queue[index]!.reason])) };
      },
    );
  }

  /** Subscription-safe: viewing context never reconciles or changes revisions. */
  async readState(sessionId: UUID): Promise<PrayerSessionState> {
    return this.database.transaction("r", this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers,
      () => this.loadStateInternal(sessionId, false));
  }

  /** Explicit workflow entry/continuation may reconcile invalid pending requests. */
  async loadState(sessionId: UUID): Promise<PrayerSessionState> {
    return this.database.transaction("rw", this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers,
      () => this.loadStateInternal(sessionId, true));
  }

  private async loadStateInternal(sessionId: UUID, reconcile: boolean): Promise<PrayerSessionState> {
    const session = await this.database.prayerSessions.get(sessionId);
    if (!session || session.deletedAt) throw new PrayerSessionUnavailableError();
    const items = await this.database.prayerSessionItems.where("sessionId").equals(sessionId).filter((item) => item.deletedAt === null).sortBy("position");
    items.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const entries: PrayerSessionEntry[] = [];
    const toReconcile: Array<{ item: PrayerSessionItem; outcome: "ANSWERED" | "SKIP" }> = [];
    for (const item of items) {
      const prayer = await this.database.prayers.get(item.prayerId);
      const activePrayer = prayer && !prayer.deletedAt ? prayer : null;
      if (reconcile && !session.endedAt && item.outcome === null && (!activePrayer || activePrayer.status !== "ACTIVE")) {
        toReconcile.push({ item, outcome: activePrayer?.status === "ANSWERED" ? "ANSWERED" : "SKIP" });
      }
      entries.push({ item, prayer: activePrayer });
    }
    if (reconcile && !session.endedAt) {
      const at = nowInstant();
      for (const change of toReconcile) await this.database.prayerSessionItems.put({ ...change.item, outcome: change.outcome, actedAt: at, updatedAt: at, revision: change.item.revision + 1 });
      await this.finishIfDone(session, at);
      return this.loadStateInternal(sessionId, false);
    }
    return { session: (await this.database.prayerSessions.get(sessionId)) ?? session, entries };
  }

  async next(sessionId: UUID, itemId: UUID, at: Instant = nowInstant(), expected: SessionExpectedRevisions = {}): Promise<SessionActionResult> {
    return this.database.transaction("rw", this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers, this.database.activityEvents, async () => {
      const session = await this.requireOpenSession(sessionId);
      const item = await this.requirePendingItem(sessionId, itemId);
      const prayer = await this.database.prayers.get(item.prayerId);
      if (!prayer || prayer.deletedAt || prayer.status !== "ACTIVE") throw new Error("This prayer is no longer active.");
      assertExpectedRevision(session, expected.session); assertExpectedRevision(item, expected.item); assertExpectedRevision(prayer, expected.prayer);
      await this.database.prayers.put({ ...prayer, lastPrayedAt: at, updatedAt: at, revision: prayer.revision + 1 });
      await this.database.prayerSessionItems.put({ ...item, outcome: "NEXT", actedAt: at, updatedAt: at, revision: item.revision + 1 });
      const event: ActivityEvent = {
        id: createId(), type: "PRAYER_PRAYED", localDate: session.localDate, occurredAt: at, timeZone: currentTimeZone(), subjectType: "prayer", subjectId: prayer.id, metadata: { sessionId },
      };
      await this.database.activityEvents.add(event);
      await this.finishIfDone(session, at);
      return { state: await this.loadStateInternal(sessionId, true), action: "NEXT", itemId };
    });
  }

  async skip(sessionId: UUID, itemId: UUID, at: Instant = nowInstant(), expected: SessionExpectedRevisions = {}): Promise<SessionActionResult> {
    return this.database.transaction("rw", this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers, async () => {
      const session = await this.requireOpenSession(sessionId);
      const item = await this.requirePendingItem(sessionId, itemId);
      assertExpectedRevision(session, expected.session); assertExpectedRevision(item, expected.item);
      await this.database.prayerSessionItems.put({ ...item, outcome: "SKIP", actedAt: at, updatedAt: at, revision: item.revision + 1 });
      await this.finishIfDone(session, at);
      return { state: await this.loadStateInternal(sessionId, true), action: "SKIP", itemId };
    });
  }

  async answer(sessionId: UUID, itemId: UUID, reflectionMd: string | null, at: Instant = nowInstant(), expected: SessionExpectedRevisions = {}): Promise<SessionActionResult> {
    return this.database.transaction("rw", [this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers, this.database.prayerResolutions, this.database.activityEvents], async () => {
      const session = await this.requireOpenSession(sessionId);
      const fresh = await this.requirePendingItem(sessionId, itemId);
      const prayer = await this.database.prayers.get(fresh.prayerId);
      if (!prayer || prayer.deletedAt || prayer.status !== "ACTIVE") throw new Error("This prayer is no longer active.");
      assertExpectedRevision(session, expected.session); assertExpectedRevision(fresh, expected.item);
      await this.prayers.answer(fresh.prayerId, reflectionMd, at, expected.prayer);
      await this.database.prayerSessionItems.put({ ...fresh, outcome: "ANSWERED", actedAt: at, updatedAt: at, revision: fresh.revision + 1 });
      await this.finishIfDone(session, at);
      return { state: await this.loadStateInternal(sessionId, true), action: "ANSWERED", itemId };
    });
  }

  async endSession(sessionId: UUID, at: Instant = nowInstant(), expectedRevision?: number): Promise<SessionActionResult | null> {
    return this.database.transaction("rw", this.database.prayerSessions, this.database.prayerSessionItems, this.database.prayers, async () => {
      const session = await this.database.prayerSessions.get(sessionId);
      if (!session || session.deletedAt) return null;
      if (!session.endedAt) {
        assertExpectedRevision(session, expectedRevision);
        await this.database.prayerSessions.put({ ...session, endedAt: at, updatedAt: at, revision: session.revision + 1 });
      }
      return { state: await this.loadStateInternal(sessionId, false), action: "ENDED" };
    });
  }

  private async requireOpenSession(sessionId: UUID): Promise<PrayerSession> {
    const session = await this.database.prayerSessions.get(sessionId);
    if (!session || session.deletedAt || session.endedAt) throw new Error("Prayer session is no longer open.");
    return session;
  }

  private async requirePendingItem(sessionId: UUID, itemId: UUID): Promise<PrayerSessionItem> {
    const item = await this.database.prayerSessionItems.get(itemId);
    if (!item || item.deletedAt || item.sessionId !== sessionId || item.outcome !== null) throw new Error("Prayer session item is no longer pending.");
    return item;
  }

  private async finishIfDone(session: PrayerSession, at: Instant): Promise<void> {
    const remaining = await this.database.prayerSessionItems.where("sessionId").equals(session.id).filter((item) => item.deletedAt === null && item.outcome === null).count();
    if (!remaining && session.endedAt === null) await this.database.prayerSessions.put({ ...session, endedAt: at, updatedAt: at, revision: session.revision + 1 });
  }
}
