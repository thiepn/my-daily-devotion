import type { MddDatabase } from "../data/database";
import { readJournalEpoch } from "./journal";
import { DraftError, type DraftListQuery, type DraftPage, type DraftReadResult, type DraftSnapshot } from "./types";
import { hasValidDraftTarget, isDraftContents, isDraftMetadata } from "./validation";

export class DraftRepository {
  constructor(private readonly database: MddDatabase) {}

  async list(query: DraftListQuery = {}): Promise<DraftPage> {
    const offset = query.offset ?? 0, limit = query.limit ?? 20;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new DraftError("invalid", "Invalid recovery page.");
    return this.database.transaction("r", this.database.editorDrafts, async () => {
      // Directory reads deliberately never touch editorDraftContents.
      const collection = query.targetKey === undefined ? this.database.editorDrafts.toCollection() : this.database.editorDrafts.where("targetKey").equals(query.targetKey);
      const rows = await collection.filter(row => row.state !== "discarded").toArray();
      rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || String(a.id).localeCompare(String(b.id)));
      return { total: rows.length, rows: rows.slice(offset, offset + limit).map(row => ({ id: row.id, metadata: isDraftMetadata(row) ? row : null })) };
    });
  }

  async read(id: string): Promise<DraftReadResult> {
    return this.database.transaction("r", this.database.editorDrafts, this.database.editorDraftContents, this.database.draftJournalState, async () => {
      const metadata = await this.database.editorDrafts.get(id);
      if (!metadata) return { kind: "missing" };
      if (metadata.formatVersion !== 1) return { kind: "unsupported" };
      if (!isDraftMetadata(metadata)) return { kind: "invalid" };
      if (metadata.state === "discarded") return { kind: "discarded" };
      if (metadata.state === "committed") return { kind: "committed", metadata };
      const contents = await this.database.editorDraftContents.get(id);
      if (!isDraftContents(contents) || contents.id !== metadata.id || contents.generation !== metadata.generation || !hasValidDraftTarget(metadata, contents.payload)) return { kind: "invalid" };
      return { kind: "active", snapshot: { metadata, contents }, previousJournal: metadata.journalEpoch !== await readJournalEpoch(this.database) };
    });
  }

  async persist(snapshot: DraftSnapshot, expectedGeneration: number | null): Promise<void> {
    snapshot = structuredClone(snapshot);
    if (!isDraftMetadata(snapshot.metadata) || !isDraftContents(snapshot.contents) || snapshot.metadata.state !== "active" || snapshot.metadata.id !== snapshot.contents.id || snapshot.metadata.generation !== snapshot.contents.generation || !hasValidDraftTarget(snapshot.metadata, snapshot.contents.payload)) throw new DraftError("invalid", "Invalid editor draft.");
    await this.database.transaction("rw", this.database.editorDrafts, this.database.editorDraftContents, this.database.draftJournalState, async () => {
      if (await readJournalEpoch(this.database) !== snapshot.metadata.journalEpoch) throw new DraftError("epoch", "This draft belongs to a previous local journal. Review it before rebinding.");
      const current = await this.database.editorDrafts.get(snapshot.metadata.id);
      if (expectedGeneration === null) {
        if (current) throw new DraftError("stale", "This editor draft already exists.");
        if (snapshot.metadata.commitment) throw new DraftError("invalid", "A new draft cannot supply a commitment.");
      } else {
        if (!current) throw new DraftError("missing", "This draft is no longer available.");
        if (!isDraftMetadata(current)) throw new DraftError("invalid", "Review this unavailable draft before discarding it.");
        if (current.state !== "active") throw new DraftError("retired", "This draft has already been retired.");
        if (current.generation !== expectedGeneration || snapshot.metadata.generation <= current.generation) throw new DraftError("stale", "A newer draft has already been kept.");
        const contents = await this.database.editorDraftContents.get(current.id);
        if (!isDraftContents(contents) || contents.generation !== current.generation) throw new DraftError("invalid", "Draft contents do not match their saved generation.");
        if (snapshot.metadata.kind !== current.kind || snapshot.metadata.targetKey !== current.targetKey || snapshot.metadata.journalEpoch !== current.journalEpoch || JSON.stringify(snapshot.metadata.lineage) !== JSON.stringify(current.lineage)) throw new DraftError("invalid", "Draft identity cannot be changed by a checkpoint.");
        snapshot = { ...snapshot, metadata: { ...snapshot.metadata, createdAt: current.createdAt, commitment: current.commitment } };
      }
      await this.database.editorDraftContents.put(snapshot.contents);
      await this.database.editorDrafts.put(snapshot.metadata);
    });
  }

  async forkForRecovery(id: string, generation: number): Promise<DraftSnapshot> {
    const forkId = crypto.randomUUID(), now = new Date().toISOString();
    return this.database.transaction("rw", this.database.editorDrafts, this.database.editorDraftContents, this.database.draftJournalState, async () => {
      const source = await this.read(id);
      if (source.kind !== "active") throw new DraftError("invalid", "This draft cannot be adopted automatically.");
      if (source.previousJournal) throw new DraftError("epoch", "Writing from a previous journal needs explicit review.");
      if (source.snapshot.metadata.commitment?.disposition === "copy-only") throw new DraftError("retired", "This action was already recorded. Keep the leftover writing for copying; do not repeat it.");
      if (source.snapshot.metadata.generation !== generation) throw new DraftError("stale", "This draft changed before recovery.");
      const snapshot: DraftSnapshot = { metadata: { ...source.snapshot.metadata, id: forkId, createdAt: now, updatedAt: now, generation: 1, commitment: null, lineage: { sourceDraftId: id, sourceGeneration: generation } }, contents: { ...source.snapshot.contents, id: forkId, generation: 1 } };
      await this.database.editorDrafts.add(snapshot.metadata);
      await this.database.editorDraftContents.add(snapshot.contents);
      return snapshot;
    });
  }

  /** Explicit writer checkpoint after a successful save. Ordinary checkpoints
   * cannot reopen a retired generation; this binds the new writing to the
   * still-retained commitment and never clears its replay protection. */
  async checkpointAfterCommit(snapshot: DraftSnapshot, expectedGeneration: number, operationId: string): Promise<void> {
    snapshot = structuredClone(snapshot);
    if (!isDraftMetadata(snapshot.metadata) || !isDraftContents(snapshot.contents) || !hasValidDraftTarget(snapshot.metadata, snapshot.contents.payload) || snapshot.metadata.id !== snapshot.contents.id || snapshot.metadata.generation !== snapshot.contents.generation || snapshot.metadata.generation <= expectedGeneration) throw new DraftError("invalid", "Invalid post-save checkpoint.");
    await this.database.transaction("rw", this.database.editorDrafts, this.database.editorDraftContents, this.database.draftJournalState, async () => {
      const current = await this.database.editorDrafts.get(snapshot.metadata.id);
      if (!current || !isDraftMetadata(current) || current.state === "discarded" || current.generation !== expectedGeneration || current.commitment?.operationId !== operationId) throw new DraftError("stale", "The save acknowledgment changed. Keep your writing open.");
      if (current.kind !== snapshot.metadata.kind || current.targetKey !== snapshot.metadata.targetKey || current.journalEpoch !== snapshot.metadata.journalEpoch || current.journalEpoch !== await readJournalEpoch(this.database)) throw new DraftError("epoch", "Review the journal context before keeping this writing.");
      await this.database.editorDraftContents.put(snapshot.contents);
      await this.database.editorDrafts.put({ ...current, state: "active", generation: snapshot.metadata.generation, updatedAt: snapshot.metadata.updatedAt, context: snapshot.metadata.context });
    });
  }

  async discard(id: string, expectedGeneration: number): Promise<void> {
    await this.database.transaction("rw", this.database.editorDrafts, this.database.editorDraftContents, async () => {
      const current = await this.database.editorDrafts.get(id);
      if (!current) throw new DraftError("missing", "Draft is no longer available.");
      if (current.generation !== expectedGeneration) throw new DraftError("stale", "This draft changed before discard.");
      // Also permits explicit discard of a corrupt/unsupported payload without adopting it.
      await this.database.editorDraftContents.delete(id);
      await this.database.editorDrafts.put({ ...current, state: "discarded", updatedAt: new Date().toISOString() });
    });
  }
}
