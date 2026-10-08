import type { MddDatabase } from "../data/database";
import type { RemovalGroupContents, RemovalGroupMetadata } from "./saved-types";
import { isRemovalMetadata } from "./removals";
import { isDraftReturnRoute } from "./validation";

export function removedUrl(id: string | null, returnTo: string, shown = 20) {
  return `/recovery${id ? `/removed/${encodeURIComponent(id)}` : ""}?${new URLSearchParams({ view: "removed", return: isDraftReturnRoute(returnTo) ? returnTo : "/data", shown: String(shown) })}`;
}
/** Read metadata only. Expiration is derived, never written while browsing. */
export async function listRemovals(db: MddDatabase, shown = 20) {
  return db.transaction("r", db.removalGroups, async () => {
    const all = await db.removalGroups.orderBy("removedAt").reverse().toArray();
    all.sort((a, b) => b.removedAt.localeCompare(a.removedAt) || a.id.localeCompare(b.id));
    return { total: all.length, rows: all.slice(0, shown).map(metadata => ({ id: metadata.id, metadata: isRemovalMetadata(metadata) ? metadata : null })) };
  });
}
export function removalState(metadata: RemovalGroupMetadata, previousJournal: boolean, at = Date.now()) {
  if (previousJournal) return "This removal belongs to a previous journal. Its retained writing can be copied, but cannot be restored here.";
  if (metadata.state === "restored") return "These records were already restored. This retained copy will not record another action.";
  if (metadata.state === "expired" || at >= Date.parse(metadata.expiresAt)) return "The original thirty-day recovery window has ended. Retained writing is available for copying.";
  if (at < Date.parse(metadata.removedAt)) return "The device clock is earlier than this removal. Check the clock before restoring.";
  return "";
}
/** Explicit readable fields, never raw records or administrative JSON. */
export function removedFields(item: RemovalGroupContents["records"][number]): {label:string;text:string}[] {
  const field = (label:string,text:string|null) => ({label,text:text??""});
  switch(item.table) {
    case "reflections": return [field("Reflection",item.record.bodyMd),field("Devotional date",item.record.localDate)];
    case "prayers": return [field("Prayer request",item.record.body),field("Status",item.record.status.toLowerCase())];
    case "verseNotes": return [field("Verse note",item.record.bodyMd)];
    case "people": return [field("Name",item.record.name),field("Relationship",item.record.relationship),field("Notes",item.record.notes)];
    case "categories": return [field("Category",item.record.name)];
    case "collections": return [field("Collection",item.record.name),field("Description",item.record.description)];
    case "collectionItems": return [field("Passage",`${item.record.translationId} · ${item.record.startVerseKey} – ${item.record.endVerseKey}`),field("Collection note",item.record.note)];
    case "prayerUpdates": return [field(item.record.type === "encouragement" ? "Encouragement" : "Prayer update",item.record.body),field("Recorded",item.record.occurredAt)];
    case "prayerResolutions": return [field("Answer note",item.record.reflectionMd),field("Answered",item.record.answeredAt)];
    case "prayerSchedules": return [field("Prayer schedule",item.record.mode.toLowerCase())];
    default: return [field("Scripture",`${item.record.translationId} · ${item.record.startVerseKey} – ${item.record.endVerseKey}`)];
  }
}
