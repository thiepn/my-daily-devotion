import type { MddDatabase } from "../data/database";
import type { Category, Person, Prayer } from "../domain/types";
import { safePrayerReturn } from "./detail-model";

export type MetadataKind = "people" | "categories";
export type MetadataRecord = Person | Category;
export interface MetadataQuery {
  q: string; entry: string | null; shown: number; prayersShown: number; returnTo: string; search: string;
}
export interface MetadataDirectory {
  records: MetadataRecord[]; total: number; matching: number; selected: MetadataRecord | null;
  untouched: boolean;
}
export interface LinkedPrayers { items: Prayer[]; total: number; available: boolean; }

function pageSize(raw: string | null, initial: number, step: number) {
  if (!raw || !/^\d+$/.test(raw)) return initial;
  const value = Number(raw), rounded = initial + Math.ceil((value - initial) / step) * step;
  return Number.isSafeInteger(rounded) && value >= initial ? rounded : initial;
}
export function parseMetadataQuery(search: string): MetadataQuery {
  const params = new URLSearchParams(search);
  const q = params.get("q") ?? "";
  const rawEntry = params.get("entry");
  const entry = rawEntry && /^[a-zA-Z0-9_-]+$/.test(rawEntry) ? rawEntry : null;
  const shown = pageSize(params.get("shown"), 20, 20);
  const prayersShown = pageSize(params.get("prayersShown"), 5, 10);
  const returnTo = safePrayerReturn(params.get("return"));
  if (!q) params.delete("q");
  if (!entry) params.delete("entry");
  for (const [name, value, initial] of [["shown", shown, 20], ["prayersShown", prayersShown, 5]] as const) {
    if (value === initial) params.delete(name); else params.set(name, String(value));
  }
  if (params.has("return") && returnTo !== params.get("return")) params.delete("return");
  return { q, entry, shown, prayersShown, returnTo, search: params.size ? "?" + params.toString() : "" };
}
export function metadataUrl(kind: MetadataKind, returnTo: string) {
  return "/prayer/" + kind + "?" + new URLSearchParams({ return: safePrayerReturn(returnTo) });
}
export function compareMetadata(a: MetadataRecord, b: MetadataRecord) {
  const order = "sortOrder" in a && "sortOrder" in b ? a.sortOrder - b.sortOrder : 0;
  return order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}
export function personFields(record: MetadataRecord): Person | null { return "notes" in record ? record : null; }
export async function readMetadataDirectory(db: MddDatabase, kind: MetadataKind, query: MetadataQuery): Promise<MetadataDirectory> {
  return db.transaction("r", db[kind], async () => {
    const records: MetadataRecord[] = await db[kind].filter(item => !item.deletedAt).toArray();
    records.sort(compareMetadata);
    const needle = query.q.trim().toLocaleLowerCase();
    const matching = records.filter(item => (item.name + " " + (personFields(item)?.relationship ?? "")).toLocaleLowerCase().includes(needle));
    return { records: matching.slice(0, query.shown), total: records.length, matching: matching.length,
      selected: records.find(item => item.id === query.entry) ?? null, untouched: await db[kind].count() === 0 };
  });
}
/** Index key intersection counts links without materializing any prayer bodies. */
export async function readMetadataCounts(db: MddDatabase, kind: MetadataKind, ids: string[]): Promise<Record<string, number>> {
  return db.transaction("r", db.prayers, async () => {
    const active = new Set(await db.prayers.where("status").anyOf("ACTIVE", "WAITING", "ANSWERED", "ARCHIVED").primaryKeys());
    // deletedAt=null isn't an IndexedDB key; tombstoned IDs are available via this index.
    for (const id of await db.prayers.orderBy("deletedAt").primaryKeys()) active.delete(id);
    const pairs = await Promise.all(ids.map(async id => [id, (await db.prayers.where(kind === "people" ? "personId" : "categoryId").equals(id).primaryKeys()).filter(key => active.has(key)).length] as const));
    return Object.fromEntries(pairs);
  });
}
export async function readLinkedPrayers(db: MddDatabase, kind: MetadataKind, id: string, shown: number): Promise<LinkedPrayers> {
  return db.transaction("r", db[kind], db.prayers, async () => {
    const parent = await db[kind].get(id);
    if (!parent || parent.deletedAt) return { items: [], total: 0, available: false };
    const items = await db.prayers.where(kind === "people" ? "personId" : "categoryId").equals(id).filter(item => !item.deletedAt).toArray();
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
    return { items: items.slice(0, shown), total: items.length, available: true };
  });
}
