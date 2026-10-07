import type { MddDatabase } from "../data/database";
import type { DraftMetadata, DraftPayload, DraftReadResult } from "./types";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import { parseVerseKey } from "../scripture/repository";
import { isDraftReturnRoute } from "./validation";

export const DRAFT_LABELS: Record<DraftPayload["kind"], string> = {
  reflection: "Reflection", "verse-note": "Verse note", "prayer-create": "New prayer",
  "prayer-wording": "Prayer wording", "prayer-update": "Prayer update", "prayer-encouragement": "Encouragement",
  "prayer-answer": "Answer note", "prayer-settings": "Prayer details", "collection-create": "New collection",
  "collection-rename": "Collection name", "collection-item-note": "Collection note", "person-create": "New person",
  "person-edit": "Person details", "category-create": "New category", "category-edit": "Category name",
};

export function parseRecoveryContext(search: string) {
  const params = new URLSearchParams(search);
  const raw = params.get("shown"), value = raw && /^\d+$/.test(raw) ? Number(raw) : 20;
  const shown = Number.isSafeInteger(value) && value >= 20 && value <= 100_000 ? Math.ceil(value / 20) * 20 : 20;
  const candidate = params.get("return");
  const returnTo = isDraftReturnRoute(candidate) ? candidate : "/data";
  return { shown, returnTo };
}

export function recoveryUrl(id: string | null, returnTo: string, shown = 20) {
  return `/recovery${id ? `/${encodeURIComponent(id)}` : ""}?${new URLSearchParams({ return: returnTo, shown: String(shown) })}`;
}

/** Metadata only: names, request bodies and notes never appear in the directory. */
export function draftTargetLabel(metadata: DraftMetadata) {
  const target = metadata.targetKey.slice(metadata.kind.length + 1);
  if (metadata.kind === "reflection") return target;
  if (metadata.kind === "verse-note") return target.replace(/^BSB:/, "BSB · ").replace(":", " – ");
  return metadata.kind.endsWith("-create") ? "Unfinished entry" : "Saved entry";
}

export interface DraftField { label: string; text: string }
function administrationFields(payload: Extract<DraftPayload, { kind: "prayer-settings" | "prayer-create" }>): DraftField[] {
  return Object.entries(payload.administration).map(([label, value]) => ({ label: ({ personId: "Person ID", categoryId: "Category ID", scheduleMode: "Schedule", weekdays: "Weekdays", intervalDays: "Interval days", anchorDate: "Starting date", monthlyDay: "Day of month", onDate: "Pray on date", eventDate: "Event date", focusUntil: "Focus until" } as Record<string, string>)[label] ?? label, text: Array.isArray(value) ? value.join(", ") : String(value ?? "") }));
}
export function draftFields(payload: DraftPayload): DraftField[] {
  switch (payload.kind) {
    case "reflection": return [{ label: "Your reflection", text: payload.bodyMd }];
    case "verse-note": return [{ label: "Your verse note", text: payload.bodyMd }, { label: "Scripture", text: `${payload.reference.translationId} · ${payload.reference.startVerseKey} – ${payload.reference.endVerseKey}` }];
    case "prayer-create": return [{ label: "Your writing", text: payload.body }, { label: "Source date", text: payload.localDate }, { label: "Source reflection", text: payload.omitSource ? "Continue without reflection" : payload.sourceReflection ? `${payload.sourceReflection.id} · reviewed revision ${payload.sourceReflection.revision}` : payload.sourceRequest ? "Source awaiting review" : "No reflection" }, { label: "Scripture", text: payload.omitReferences ? "Continue without linked passages" : payload.references.map(reference => `${reference.translationId} · ${reference.startVerseKey} – ${reference.endVerseKey}`).join("\n") }, ...administrationFields(payload)];
    case "prayer-wording": case "prayer-update": case "prayer-encouragement": case "prayer-answer": return [{ label: "Your writing", text: payload.body }, {label:"Saved request when writing began",text:payload.baseline.body},{label:"Status then",text:payload.baseline.status.toLowerCase()},{label:"Reviewed revision",text:String(payload.baseline.revision)}];
    case "prayer-settings": return administrationFields(payload);
    case "person-create": case "person-edit": return [{ label: "Name", text: payload.name }, { label: "Relationship", text: payload.relationship }, { label: "Notes", text: payload.notes }];
    case "collection-item-note": return [{ label: "Collection note", text: payload.note }];
    default: return [{ label: "Name", text: payload.name }];
  }
}

/** Reads only; the editor remains responsible for explicit comparison and fork.
 * No session start/reconciliation, category seeding or domain mutation here. */
export async function reflectionRecoveryDestination(database: MddDatabase, result: DraftReadResult): Promise<string | null> {
  if (result.kind !== "active" || result.previousJournal || result.snapshot.metadata.commitment?.disposition === "copy-only") return null;
  const payload = result.snapshot.contents.payload;
  if (payload.kind === "prayer-create") return `/prayer/new?${new URLSearchParams({ draft: result.snapshot.metadata.id, return: result.snapshot.metadata.context.returnTo })}`;
  if (payload.kind === "prayer-settings") {
    const prayer = await database.prayers.get(payload.baseline.id);
    if (!prayer || prayer.deletedAt || prayer.status !== "ACTIVE" && prayer.status !== "WAITING") return null;
    const origin = new URL(result.snapshot.metadata.context.returnTo,"https://mdd.invalid");
    const params = origin.pathname === `/prayer/${prayer.id}/settings` ? new URLSearchParams(origin.search) : new URLSearchParams({return:result.snapshot.metadata.context.returnTo});
    params.set("draft",result.snapshot.metadata.id);
    return `/prayer/${prayer.id}/settings?${params}`;
  }
  if (["prayer-wording", "prayer-update", "prayer-encouragement", "prayer-answer"].includes(payload.kind) && "baseline" in payload && payload.baseline && "status" in payload.baseline) {
    if (payload.kind === "prayer-answer" && payload.session) return null; // Session adapter ships separately.
    const prayer = await database.prayers.get(payload.baseline.id);
    if (!prayer || prayer.deletedAt || prayer.status !== "ACTIVE" && prayer.status !== "WAITING") return null;
    const origin = new URL(result.snapshot.metadata.context.returnTo,"https://mdd.invalid");
    const params = origin.pathname === `/prayer/${prayer.id}` ? new URLSearchParams(origin.search) : new URLSearchParams({return:result.snapshot.metadata.context.returnTo});
    params.set("draft",result.snapshot.metadata.id);params.set("edit",payload.kind.slice(7));
    return `/prayer/${prayer.id}?${params}`;
  }
  if (payload.kind === "verse-note") {
    const current = await new VerseNoteRepository(database).getSavedRecord(payload.reference);
    if (current?.deletedAt || payload.baseline && (!current || current.id !== payload.baseline.id)) return null;
    const start = parseVerseKey(payload.reference.startVerseKey), end = parseVerseKey(payload.reference.endVerseKey);
    const origin = new URL(result.snapshot.metadata.context.returnTo, "https://mdd.invalid");
    const params = origin.pathname.startsWith("/bible/") ? new URLSearchParams(origin.search) : new URLSearchParams({ return: result.snapshot.metadata.context.returnTo });
    params.set("draft", result.snapshot.metadata.id); params.set("translation", payload.reference.translationId); params.set("start", payload.reference.startVerseKey); params.set("end", payload.reference.endVerseKey);
    params.set("verse", String(start.verse)); params.set("endVerse", String(start.bookId === end.bookId && start.chapter === end.chapter ? end.verse : start.verse));
    return `/bible/${start.bookId}/${start.chapter}?${params}`;
  }
  if (payload.kind !== "reflection") return null; // Other editors are integrated in separate slices.
  const rows = await database.reflections.where("localDate").equals(payload.localDate).toArray();
  if (payload.baseline ? !rows.some(row => row.id === payload.baseline!.id && !row.deletedAt) : rows.some(row => row.deletedAt)) return null;
  const params = new URLSearchParams({ draft: result.snapshot.metadata.id, return: result.snapshot.metadata.context.returnTo });
  return `/today/reflection/${payload.localDate}?${params}`;
}
