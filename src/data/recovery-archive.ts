import type { MddDatabase } from "./database";
import type { DraftMetadata, DraftContents } from "../recovery/types";
import type { SavedVersionMetadata, SavedVersionContents, RemovalGroupMetadata, RemovalGroupContents } from "../recovery/saved-types";
import { isDraftMetadata, isDraftContents, hasValidDraftTarget } from "../recovery/validation";
import { isSavedVersionMetadata, isSavedVersionContents } from "../recovery/saved-versions";
import { isRemovalPair } from "../recovery/removals";
import { readJournalEpoch } from "../recovery/journal";

export const RECOVERY_TABLE_NAMES = ["editorDrafts", "editorDraftContents", "savedVersions", "savedVersionContents", "removalGroups", "removalGroupContents"] as const;
export type RecoveryTableName = typeof RECOVERY_TABLE_NAMES[number];
export interface RecoveryCounts { activeDrafts: number; copyOnlyDrafts: number; priorVersions: number; eligibleRemovals: number; expiredRemovals: number }
export interface RecoveryArchivePayload {
  version: 1; sourceEpoch: string;
  stores: {
    editorDrafts: DraftMetadata[]; editorDraftContents: DraftContents[];
    savedVersions: SavedVersionMetadata[]; savedVersionContents: SavedVersionContents[];
    removalGroups: RemovalGroupMetadata[]; removalGroupContents: RemovalGroupContents[];
  };
}
export type RecoveryStores = RecoveryArchivePayload["stores"];
export type RecoveryInsert = Partial<{ [K in RecoveryTableName]: RecoveryStores[K] }>;
const uuid = (v: unknown) => typeof v === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v);
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: readonly string[]) => Object.keys(v).length === names.length && names.every(n => Object.hasOwn(v, n));
export function privateRecoveryTables(db: MddDatabase) { return RECOVERY_TABLE_NAMES.map(name => db[name]); }
export async function captureRecoveryPayload(db: MddDatabase): Promise<RecoveryArchivePayload> {
  const stores = {} as RecoveryStores;
  for (const name of RECOVERY_TABLE_NAMES) (stores as unknown as Record<string,unknown[]>)[name] = await db[name].toArray();
  // A committed/discarded draft can legitimately retain metadata without a
  // body. These are not recoverable writing and must not block export.
  const draftBodies = new Map(stores.editorDraftContents.map(row => [row.id, row]));
  stores.editorDrafts = stores.editorDrafts.filter(row => row.state === "active" || (row.state === "committed" && draftBodies.has(row.id)));
  const usedDraftIds = new Set(stores.editorDrafts.map(row => row.id));
  stores.editorDraftContents = stores.editorDraftContents.filter(row => usedDraftIds.has(row.id));
  // Historical restored/expired groups can have their private bodies pruned.
  // Such metadata is not a usable recovery copy and is excluded as a pair.
  const removalBodies = new Map(stores.removalGroupContents.map(row => [row.id, row]));
  stores.removalGroups = stores.removalGroups.filter(row => row.state === "available" || removalBodies.has(row.id));
  const groupIds = new Set(stores.removalGroups.map(row => row.id));
  stores.removalGroupContents = stores.removalGroupContents.filter(row => groupIds.has(row.id));
  const payload: RecoveryArchivePayload = { version: 1, sourceEpoch: await readJournalEpoch(db), stores };
  validateRecoveryPayload(payload);
  return payload;
}
export async function readRecoveryState(db: MddDatabase): Promise<RecoveryArchivePayload> {
  return db.transaction("r", [...privateRecoveryTables(db), db.draftJournalState], () => captureRecoveryPayload(db));
}
export function recoveryCounts(p: RecoveryArchivePayload, at = Date.now()): RecoveryCounts {
  return {
    activeDrafts: p.stores.editorDrafts.filter(x => x.state === "active" && x.journalEpoch === p.sourceEpoch).length,
    copyOnlyDrafts: p.stores.editorDrafts.filter(x => x.state === "committed" || x.journalEpoch !== p.sourceEpoch).length,
    priorVersions: p.stores.savedVersions.length,
    eligibleRemovals: p.stores.removalGroups.filter(x => x.state === "available" && x.journalEpoch === p.sourceEpoch && Date.parse(x.expiresAt) > at).length,
    expiredRemovals: p.stores.removalGroups.filter(x => x.state !== "available" || x.journalEpoch !== p.sourceEpoch || Date.parse(x.expiresAt) <= at).length,
  };
}
function validatePairs(metadata: unknown[], contents: unknown[], validMeta: (x: unknown) => boolean, validBody: (x: unknown) => boolean, validPair: (m: any, c: any) => boolean) {
  const body = new Map<string, unknown>();
  for (const row of contents) {
    if (!validBody(row)) throw new Error("Recovery archive has invalid private contents.");
    const id = (row as {id:string}).id;
    if (body.has(id)) throw new Error("Recovery archive has duplicate private contents.");
    body.set(id, row);
  }
  const seen = new Set<string>();
  for (const row of metadata) {
    if (!validMeta(row)) throw new Error("Recovery archive has invalid private metadata.");
    const id = (row as {id:string}).id;
    if (seen.has(id)) throw new Error("Recovery archive has duplicate private identities.");
    seen.add(id);
    if (!validPair(row, body.get(id))) throw new Error("Recovery archive has mismatched private records.");
  }
  if (seen.size !== body.size) throw new Error("Recovery archive has orphan private contents.");
}
export function validateRecoveryPayload(value: unknown): asserts value is RecoveryArchivePayload {
  if (!obj(value) || !keys(value, ["version", "sourceEpoch", "stores"]) || value.version !== 1 || !uuid(value.sourceEpoch) ||
    !obj(value.stores) || !keys(value.stores, RECOVERY_TABLE_NAMES)) throw new Error("Unsupported recovery payload version or structure.");
  if (JSON.stringify(value).length > 32 * 1024 * 1024) throw new Error("Recovery payload is too large.");
  for (const name of RECOVERY_TABLE_NAMES) if (!Array.isArray(value.stores[name]) || value.stores[name].length > 10000) throw new Error("Recovery payload table is invalid or too large.");
  const s = value.stores as unknown as RecoveryStores;
  validatePairs(s.editorDrafts, s.editorDraftContents, isDraftMetadata, isDraftContents,
    (m: DraftMetadata, c: DraftContents) => !!c && m.id === c.id && m.state !== "discarded" && m.generation === c.generation && hasValidDraftTarget(m, c.payload));
  validatePairs(s.savedVersions, s.savedVersionContents, isSavedVersionMetadata, isSavedVersionContents,
    (m: SavedVersionMetadata, c: SavedVersionContents) => !!c && m.id === c.id && m.kind === c.writing.kind && (c.writing.kind !== "reflection" || m.writingDate === c.writing.localDate));
  validatePairs(s.removalGroups, s.removalGroupContents,
    x => obj(x) && x.formatVersion === 1, x => obj(x) && x.formatVersion === 1, isRemovalPair);
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (obj(v)) return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v) ?? "null";
}
export function recoveryFingerprint(p: RecoveryArchivePayload): string { return canonical(p); }
/** All imported writing is detached from the current journal, so it is copy-only. */
export function planRecoveryImport(incoming: RecoveryArchivePayload, local: RecoveryArchivePayload): RecoveryInsert {
  validateRecoveryPayload(incoming); validateRecoveryPayload(local);
  const result: Record<string, unknown> = {};
  const remap = new Map<string,string>();
  const olderEpoch = (v: string) => {
    if (!remap.has(v)) { let id = crypto.randomUUID(); while (id === local.sourceEpoch) id = crypto.randomUUID(); remap.set(v,id); }
    return remap.get(v)!;
  };
  const families = [["editorDrafts","editorDraftContents"],["savedVersions","savedVersionContents"],["removalGroups","removalGroupContents"]] as const;
  for (const [metaTable, bodyTable] of families) {
    const previousMeta = new Map((local.stores[metaTable] as Array<{id:string}>).map(r => [r.id,r]));
    const previousBody = new Map((local.stores[bodyTable] as Array<{id:string}>).map(r => [r.id,r]));
    const archiveBody = new Map((incoming.stores[bodyTable] as Array<{id:string}>).map(r => [r.id,r]));
    const metas: Array<{id:string;journalEpoch:string}> = [];
    const bodies: Array<{id:string}> = [];
    for (const meta of incoming.stores[metaTable] as Array<{id:string;journalEpoch:string}>) {
      const contents = archiveBody.get(meta.id)!;
      const existing = previousMeta.get(meta.id);
      const oldContent = previousBody.get(meta.id);
      if (existing && oldContent &&
        canonical({...existing,journalEpoch:undefined}) === canonical({...meta,journalEpoch:undefined}) &&
        canonical(oldContent) === canonical(contents)) continue;
      let id = meta.id;
      if (existing || previousBody.has(id)) {
        id = crypto.randomUUID();
        while (previousMeta.has(id) || previousBody.has(id)) id = crypto.randomUUID();
      }
      const m = {...meta,id,journalEpoch:olderEpoch(meta.journalEpoch)}, c = {...contents,id};
      metas.push(m); bodies.push(c);
      previousMeta.set(id,m);previousBody.set(id,c);
    }
    result[metaTable] = metas; result[bodyTable] = bodies;
  }
  return result as unknown as RecoveryInsert;
}
export async function commitRecoveryImport(db: MddDatabase, planned: RecoveryInsert) {
  for (const name of RECOVERY_TABLE_NAMES) {
    const rows = planned[name] as unknown[] | undefined;
    if (rows?.length) await db.table(name).bulkAdd(rows);
  }
}
