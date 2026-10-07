import type { DraftContents, DraftMetadata, DraftPayload } from "./types";

type Check = (value: unknown) => boolean;
const string: Check = value => typeof value === "string";
const boolean: Check = value => typeof value === "boolean";
const integer: Check = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positive: Check = value => integer(value) && (value as number) > 0;
const uuid: Check = value => string(value) && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value as string);
const instant: Check = value => string(value) && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value as string) && Number.isFinite(Date.parse(value as string));
const date: Check = value => string(value) && /^\d{4}-\d{2}-\d{2}$/.test(value as string) && Number.isFinite(Date.parse(value as string)) && new Date(value as string).toISOString().slice(0, 10) === value;
const nullable = (check: Check): Check => value => value === null || check(value);
const array = (check: Check): Check => value => Array.isArray(value) && value.every(check);
const oneOf = (...values: string[]): Check => value => typeof value === "string" && values.includes(value);
const object = (fields: { [key: string]: Check }): Check => value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as { [key: string]: unknown };
  return Object.keys(row).length === Object.keys(fields).length && Object.entries(fields).every(([key, check]) => Object.hasOwn(row, key) && check(row[key]));
};
const baseline = object({ id: uuid, revision: positive });
const prayerBaseline = object({ id: uuid, revision: positive, status: oneOf("ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"), body: string });
const reference = object({ translationId: oneOf("BSB"), startVerseKey: value => string(value) && /^[a-zA-Z0-9]+\.[1-9]\d*\.[1-9]\d*$/.test(value as string), endVerseKey: value => string(value) && /^[a-zA-Z0-9]+\.[1-9]\d*\.[1-9]\d*$/.test(value as string) });
const administration = object({ personId: nullable(uuid), categoryId: nullable(uuid), scheduleMode: oneOf("ROTATION", "DAILY", "WEEKDAYS", "INTERVAL_DAYS", "MONTHLY", "ON_DATE", "MANUAL_ONLY"), weekdays: array(value => integer(value) && (value as number) <= 7 && (value as number) >= 1), intervalDays: string, anchorDate: string, monthlyDay: string, onDate: string, eventDate: string, focusUntil: string });
const prayerCaptureFields = { kind: oneOf("prayer-create"), localDate: date, body: string, administration, sourceReflection: nullable(baseline), references: array(reference), omitSource: boolean, omitReferences: boolean };
const prayerSettingsFields = {kind: oneOf("prayer-settings"), administration, baseline: prayerBaseline, schedule: nullable(object({id:uuid,revision:positive,administration}))};
const payloadChecks: { [K in DraftPayload["kind"]]: Check } = {
  reflection: object({ kind: oneOf("reflection"), localDate: date, bodyMd: string, baseline: nullable(object({ id: uuid, revision: positive, bodyMd: string })), pendingReferences: array(reference), dismissedReferences: boolean }),
  "verse-note": object({ kind: oneOf("verse-note"), reference, bodyMd: string, baseline: nullable(object({ id: uuid, revision: positive, bodyMd: string })) }),
  "prayer-create": value => object(prayerCaptureFields)(value) || object({ ...prayerCaptureFields, sourceRequest: object({ id: nullable(uuid) }) })(value),
  "prayer-wording": object({ kind: oneOf("prayer-wording"), body: string, baseline: prayerBaseline }),
  "prayer-update": object({ kind: oneOf("prayer-update"), body: string, baseline: prayerBaseline }),
  "prayer-encouragement": object({ kind: oneOf("prayer-encouragement"), body: string, baseline: prayerBaseline }),
  "prayer-answer": object({ kind: oneOf("prayer-answer"), body: string, baseline: prayerBaseline, session: nullable(object({ id: uuid, itemId: uuid, localDate: date })) }),
  "prayer-settings": value => object(prayerSettingsFields)(value) || object({...prayerSettingsFields,baselineAdministration:administration})(value),
  "collection-create": object({ kind: oneOf("collection-create"), name: string }),
  "collection-rename": object({ kind: oneOf("collection-rename"), name: string, baseline: object({ id: uuid, revision: positive, name: string }) }),
  "collection-item-note": object({ kind: oneOf("collection-item-note"), note: string, collection: baseline, baseline: object({ id: uuid, revision: positive, note: nullable(string) }) }),
  "person-create": object({ kind: oneOf("person-create"), name: string, relationship: string, notes: string }),
  "person-edit": object({ kind: oneOf("person-edit"), name: string, relationship: string, notes: string, baseline: object({ id: uuid, revision: positive, name: string, relationship: nullable(string), notes: nullable(string) }) }),
  "category-create": object({ kind: oneOf("category-create"), name: string }),
  "category-edit": object({ kind: oneOf("category-edit"), name: string, baseline: object({ id: uuid, revision: positive, name: string }) }),
};
export function isDraftPayload(value: unknown): value is DraftPayload {
  if (!value || typeof value !== "object" || !("kind" in value) || typeof value.kind !== "string") return false;
  const check = Object.hasOwn(payloadChecks, value.kind) ? payloadChecks[value.kind as DraftPayload["kind"]] : null;
  return Boolean(check?.(value));
}
// Only internal routes; never adopt a persisted external URL, fragment, or scheme.
export function isDraftReturnRoute(value: unknown): value is string {
  return typeof value === "string" && /^\/(?:today|bible|prayer|reflection|history|data|search|reading-plan|recovery)(?:[/?]|$)/.test(value) && !/[\\#\u0000-\u001f]/.test(value) && !/%(?:00|0[ad]|5c)/i.test(value);
}
const metadataCheck = object({ id: uuid, formatVersion: value => value === 1, kind: oneOf(...Object.keys(payloadChecks)), targetKey: value => string(value) && (value as string).length > 0 && (value as string).length <= 500, journalEpoch: uuid, createdAt: instant, updatedAt: instant, generation: positive, state: oneOf("active", "committed", "discarded"), context: object({ returnTo: isDraftReturnRoute, reading: nullable(object({ enrollmentId: uuid, assignmentSequence: positive, readingIndex: integer })) }), lineage: nullable(object({ sourceDraftId: uuid, sourceGeneration: positive })), commitment: nullable(object({ operationId: uuid, submittedGeneration: positive, targetKey: string, committedAt: instant, records: array(baseline), disposition: oneOf("editable", "copy-only") })) });
export function isDraftMetadata(value: unknown): value is DraftMetadata {
  if (!metadataCheck(value)) return false;
  const row = value as DraftMetadata;
  if (!row.targetKey.startsWith(`${row.kind}:`)) return false;
  const target = row.targetKey.slice(row.kind.length + 1);
  if (row.kind === "reflection" ? !date(target) : row.kind === "verse-note" ? !/^BSB:[a-zA-Z0-9]+\.[1-9]\d*\.[1-9]\d*:[a-zA-Z0-9]+\.[1-9]\d*\.[1-9]\d*$/.test(target) : !uuid(target)) return false;
  return (row.state !== "committed" || row.commitment !== null) && (!row.commitment || row.commitment.submittedGeneration <= row.generation);
}
export function isDraftContents(value: unknown): value is DraftContents { return object({ id: uuid, generation: positive, payload: isDraftPayload })(value); }

export function draftTargetKey(payload: DraftPayload, captureId: string): string {
  if (payload.kind === "reflection") return `reflection:${payload.localDate}`;
  if (payload.kind === "verse-note") return `verse-note:${payload.reference.translationId}:${payload.reference.startVerseKey}:${payload.reference.endVerseKey}`;
  if ("baseline" in payload && payload.baseline) return `${payload.kind}:${payload.baseline.id}`;
  return `${payload.kind}:${captureId}`;
}
export function hasValidDraftTarget(metadata: DraftMetadata, payload: DraftPayload): boolean {
  if (payload.kind !== metadata.kind) return false;
  const expected = draftTargetKey(payload, metadata.id);
  if (payload.kind.endsWith("-create")) return metadata.targetKey.startsWith(`${payload.kind}:`) && uuid(metadata.targetKey.slice(payload.kind.length + 1));
  return metadata.targetKey === expected;
}
