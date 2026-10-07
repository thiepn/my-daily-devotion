import type { LocalDate, PrayerStatus, ScriptureReference } from "../domain/types";
import type { PrayerAdministrationValue } from "../prayer/PrayerAdministrationFields";

/** Private editor data. Never include these stores in portability or search. */
export interface RecordBaseline { id: string; revision: number }
interface PrayerBaseline extends RecordBaseline { status: PrayerStatus; body: string }
export type DraftPayload =
  | { kind: "reflection"; localDate: LocalDate; bodyMd: string; baseline: (RecordBaseline & { bodyMd: string }) | null; pendingReferences: ScriptureReference[]; dismissedReferences: boolean }
  | { kind: "verse-note"; reference: ScriptureReference; bodyMd: string; baseline: (RecordBaseline & { bodyMd: string }) | null }
  | { kind: "prayer-create"; localDate: LocalDate; body: string; administration: PrayerAdministrationValue; sourceReflection: RecordBaseline | null; references: ScriptureReference[]; omitSource: boolean; omitReferences: boolean }
  | { kind: "prayer-wording" | "prayer-update" | "prayer-encouragement"; body: string; baseline: PrayerBaseline }
  | { kind: "prayer-answer"; body: string; baseline: PrayerBaseline; session: { id: string; itemId: string; localDate: LocalDate } | null }
  | { kind: "prayer-settings"; administration: PrayerAdministrationValue; baseline: PrayerBaseline; schedule: (RecordBaseline & { administration: PrayerAdministrationValue }) | null }
  | { kind: "collection-create"; name: string }
  | { kind: "collection-rename"; name: string; baseline: RecordBaseline & { name: string } }
  | { kind: "collection-item-note"; note: string; collection: RecordBaseline; baseline: RecordBaseline & { note: string | null } }
  | { kind: "person-create"; name: string; relationship: string; notes: string }
  | { kind: "person-edit"; name: string; relationship: string; notes: string; baseline: RecordBaseline & { name: string; relationship: string | null; notes: string | null } }
  | { kind: "category-create"; name: string }
  | { kind: "category-edit"; name: string; baseline: RecordBaseline & { name: string } };

export interface DraftContext {
  returnTo: string;
  reading: { enrollmentId: string; assignmentSequence: number; readingIndex: number } | null;
}
export interface DraftCommitMarker {
  operationId: string;
  submittedGeneration: number;
  targetKey: string;
  committedAt: string;
  records: RecordBaseline[];
  disposition: "editable" | "copy-only";
}
export interface DraftMetadata {
  id: string;
  formatVersion: 1;
  kind: DraftPayload["kind"];
  targetKey: string;
  journalEpoch: string;
  createdAt: string;
  updatedAt: string;
  generation: number;
  state: "active" | "committed" | "discarded";
  context: DraftContext;
  lineage: { sourceDraftId: string; sourceGeneration: number } | null;
  commitment: DraftCommitMarker | null;
}
export interface DraftContents { id: string; generation: number; payload: DraftPayload }
export interface DraftJournalState { key: "journal"; formatVersion: 1; epoch: string }
export interface DraftSnapshot { metadata: DraftMetadata; contents: DraftContents }
export type DraftReadResult =
  | { kind: "active"; snapshot: DraftSnapshot; previousJournal: boolean }
  | { kind: "committed"; metadata: DraftMetadata }
  | { kind: "missing" | "discarded" | "unsupported" | "invalid" };
export interface DraftListQuery { targetKey?: string; offset?: number; limit?: number }
export interface DraftPage { rows: Array<{ id: string; metadata: DraftMetadata | null }>; total: number }
export class DraftError extends Error {
  constructor(public readonly code: "invalid" | "missing" | "stale" | "retired" | "epoch" | "operation", message: string) { super(message); this.name = "DraftError"; }
}
