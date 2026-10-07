import type { MddDatabase } from "../data/database";
import type { PortableTableName } from "../data/portable-tables";
import { readJournalEpoch } from "./journal";
import { DraftError, type DraftCommitMarker, type DraftPayload, type DraftSnapshot, type RecordBaseline } from "./types";
import { hasValidDraftTarget, isDraftContents, isDraftMetadata } from "./validation";

export interface DraftSaveContext { snapshot: DraftSnapshot; operationId: string }
export interface CommittedDraftSaveResult { kind: "committed"; marker: DraftCommitMarker; replayed: boolean; newerWriting: boolean }
/** Storage-level contract. Editor adapters supply their existing domain operation
 * and target/revision checks; no editor may invoke this from recovery browsing. */
export interface DraftSaveOperation {
  tables: readonly PortableTableName[];
  validate: (submitted: DraftPayload) => Promise<void>;
  save: (submitted: DraftPayload) => Promise<{ records: RecordBaseline[]; disposition: DraftCommitMarker["disposition"] }>;
  // Only an adapter with an existing safe edit operation may rebase newer text.
  rebase?: (newer: DraftPayload, records: RecordBaseline[]) => DraftPayload;
}

export async function saveWithDraft(database: MddDatabase, context: DraftSaveContext, operation: DraftSaveOperation): Promise<CommittedDraftSaveResult> {
  const { snapshot, operationId } = structuredClone(context);
  if (!isDraftMetadata(snapshot.metadata) || !isDraftContents(snapshot.contents) || snapshot.metadata.id !== snapshot.contents.id || snapshot.metadata.generation !== snapshot.contents.generation || !hasValidDraftTarget(snapshot.metadata, snapshot.contents.payload) || snapshot.metadata.state !== "active" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(operationId)) throw new DraftError("invalid", "Invalid draft save context.");
  const committedAt = new Date().toISOString();
  const tables = [...operation.tables.map(name => database.table(name)), database.editorDrafts, database.editorDraftContents, database.draftJournalState];
  return database.transaction("rw", tables, async () => {
    if (snapshot.metadata.journalEpoch !== await readJournalEpoch(database)) throw new DraftError("epoch", "Review this previous-journal draft before saving.");
    const current = await database.editorDrafts.get(snapshot.metadata.id);
    if (current && !isDraftMetadata(current)) throw new DraftError("invalid", "The draft metadata is unavailable.");
    if (current?.commitment?.operationId === operationId) {
      if (current.commitment.submittedGeneration !== snapshot.metadata.generation || current.commitment.targetKey !== snapshot.metadata.targetKey) throw new DraftError("operation", "This operation was already used for different writing.");
      return { kind: "committed", marker: current.commitment, replayed: true, newerWriting: current.state === "active" };
    }
    if (current?.state === "discarded" || current?.state === "committed") throw new DraftError("retired", "This draft was already retired.");
    if (current && (current.journalEpoch !== snapshot.metadata.journalEpoch || current.kind !== snapshot.metadata.kind || current.targetKey !== snapshot.metadata.targetKey || current.generation < snapshot.metadata.generation)) throw new DraftError("stale", "Keep the submitted draft before saving.");
    const kept = current ? await database.editorDraftContents.get(current.id) : null;
    if (current && (!isDraftContents(kept) || kept.generation !== current.generation)) throw new DraftError("invalid", "The kept draft generation is unavailable.");
    if (current?.generation === snapshot.metadata.generation && JSON.stringify(kept?.payload) !== JSON.stringify(snapshot.contents.payload)) throw new DraftError("stale", "The submitted writing differs from its kept generation.");
    if (current?.commitment && (!operation.rebase || current.commitment.disposition !== "editable")) throw new DraftError("operation", "Keep this leftover writing for review; do not repeat the recorded action.");
    await operation.validate(snapshot.contents.payload);
    const outcome = await operation.save(snapshot.contents.payload);
    const newerWriting = Boolean(current && current.generation > snapshot.metadata.generation);
    const marker: DraftCommitMarker = { operationId, submittedGeneration: snapshot.metadata.generation, targetKey: snapshot.metadata.targetKey, committedAt, records: outcome.records, disposition: operation.rebase ? outcome.disposition : "copy-only" };
    const metadata = { ...(current ?? snapshot.metadata), updatedAt: committedAt, commitment: marker, state: newerWriting ? "active" as const : "committed" as const };
    if (newerWriting && kept) {
      const contents = { ...kept, payload: operation.rebase ? operation.rebase(kept.payload, outcome.records) : kept.payload };
      if (!isDraftContents(contents) || contents.payload.kind !== metadata.kind) throw new DraftError("invalid", "The updated recovery baseline is invalid.");
      await database.editorDraftContents.put(contents);
    } else await database.editorDraftContents.delete(metadata.id);
    if (!isDraftMetadata(metadata)) throw new DraftError("invalid", "Invalid committed recovery result.");
    await database.editorDrafts.put(metadata);
    const lineage = metadata.lineage;
    if (lineage) {
      const source = await database.editorDrafts.get(lineage.sourceDraftId);
      if (source && isDraftMetadata(source) && source.state === "active" && source.generation === lineage.sourceGeneration && source.journalEpoch === metadata.journalEpoch) {
        await database.editorDraftContents.delete(source.id);
        await database.editorDrafts.put({ ...source, state: "committed", commitment: { ...marker, submittedGeneration: source.generation, targetKey: source.targetKey }, updatedAt: committedAt });
      }
    }
    return { kind: "committed", marker, replayed: false, newerWriting };
  });
}

/** Call only after the writer barrier and newer-input checkpoint have settled. */
export async function acknowledgeDraftCommit(database: MddDatabase, id: string, operationId: string): Promise<void> {
  await database.transaction("rw", database.editorDrafts, database.editorDraftContents, async () => {
    const current = await database.editorDrafts.get(id);
    if (!current || current.state !== "committed" || current.commitment?.operationId !== operationId) throw new DraftError("stale", "The committed draft still needs acknowledgment or newer writing.");
    if (await database.editorDraftContents.get(id)) throw new DraftError("stale", "Newer writing must be kept before acknowledgment.");
    await database.editorDrafts.delete(id);
  });
}
