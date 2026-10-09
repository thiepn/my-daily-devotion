import { PRAYER_DEPTH_TARGETS, type PrayerDepth, type PrayerSessionState } from "../data/repositories/prayer-sessions";
import type { MddDatabase } from "../data/database";
import type { PrayerUpdate, ScriptureLink } from "../domain/types";
import { safePrayerReturn } from "./detail-model";

export interface PrayerSessionContext {
  sessionId: string | null;
  invalidSession: boolean;
  depth: PrayerDepth;
  returnTo: string;
  draftId: string | null;
}

export function parsePrayerSessionContext(search: string): PrayerSessionContext {
  const params = new URLSearchParams(search);
  const rawId = params.get("session");
  const valid = rawId !== null && /^[a-zA-Z0-9_-]{1,128}$/.test(rawId);
  const requested = params.get("depth") ?? "quick";
  return {
    sessionId: valid ? rawId : null,
    invalidSession: rawId !== null && !valid,
    depth: Object.hasOwn(PRAYER_DEPTH_TARGETS, requested) ? requested as PrayerDepth : "quick",
    returnTo: safePrayerReturn(params.get("return")),
    draftId: /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.get("draft")??"")?params.get("draft"):null,
  };
}

export function prayerSessionUrl({ sessionId, depth = "quick", returnTo = "/prayer", draftId }: { sessionId?: string | undefined; depth?: PrayerDepth; returnTo?: string; draftId?: string | null } = {}): string {
  const params = new URLSearchParams(sessionId ? { session: sessionId } : { depth });
  params.set("return", safePrayerReturn(returnTo));
  if(sessionId&&draftId&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(draftId))params.set("draft",draftId);
  return `/prayer/session?${params}`;
}

export function sessionPresentation(state: PrayerSessionState) {
  const pending = state.entries.filter(entry => entry.item.outcome === null);
  const current = state.session.endedAt ? null : pending[0] ?? null;
  return {
    current,
    position: current ? state.entries.findIndex(entry => entry.item.id === current.item.id) + 1 : null,
    total: state.entries.length,
    last: pending.filter(entry => entry.prayer?.status === "ACTIVE").length === 1,
    closed: state.session.endedAt ? pending.length ? "ended" as const : "finished" as const : null,
  };
}

export function sessionReason(reason?: string): string {
  if (reason === "focus") return "Set aside for focused prayer.";
  if (reason === "event-tomorrow") return "An important date is coming tomorrow.";
  if (reason === "event-today") return "An important date is today.";
  if (reason === "event-follow-up") return "A moment to pray after an important date.";
  if (reason?.startsWith("schedule:")) return "Scheduled for prayer today.";
  if (reason === "never-prayed") return "A request you have not prayed in MDD yet.";
  if (reason === "least-recently-prayed") return "Returning gently to an earlier request.";
  return "Part of your saved session.";
}

export interface SessionRequestContext { latest: PrayerUpdate | null; links: ScriptureLink[]; }
export function readSessionRequestContext(database: MddDatabase, prayerId: string): Promise<SessionRequestContext> {
  return database.transaction("r", database.prayers, database.prayerUpdates, database.scriptureLinks, async () => {
    const prayer = await database.prayers.get(prayerId);
    if (!prayer || prayer.deletedAt) return { latest: null, links: [] };
    const [updates, links] = await Promise.all([
      database.prayerUpdates.where("prayerId").equals(prayerId).filter(item => !item.deletedAt).toArray(),
      database.scriptureLinks.where("[ownerType+ownerId]").equals(["prayer", prayerId]).filter(item => !item.deletedAt).sortBy("createdAt"),
    ]);
    updates.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
    return { latest: updates[0] ?? null, links };
  });
}

export function readSessionPerson(database: MddDatabase, prayerId: string) {
  return database.transaction("r", database.prayers, database.people, async () => {
    const prayer = await database.prayers.get(prayerId);
    if (!prayer || prayer.deletedAt || !prayer.personId) return null;
    const person = await database.people.get(prayer.personId);
    return person && !person.deletedAt ? person : null;
  });
}
