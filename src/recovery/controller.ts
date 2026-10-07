import type { MddDatabase } from "../data/database";
import type { PortableTableName } from "../data/portable-tables";
import { readJournalEpoch } from "./journal";
import { DraftRepository } from "./repository";
import { DraftWriter } from "./writer";
import { acknowledgeDraftCommit, type CommittedDraftSaveResult, type DraftSaveContext } from "./commit";
import { DraftError, type DraftContext, type DraftPayload, type DraftSnapshot } from "./types";
import { draftTargetKey } from "./validation";

export type DraftStatus = "idle" | "keeping" | "kept" | "failed" | "copy-only";
export interface DraftControllerState { status: DraftStatus; error: string; }
type Rebase = (latest: DraftPayload, submitted: DraftPayload, result: CommittedDraftSaveResult) => DraftPayload;

/** An editor owns this controller and UUID. Neither routes nor tab storage
 * identify writers. Only explicit commit invokes the domain save callback. */
export class DurableDraftController {
  private snapshot: DraftSnapshot | null = null;
  private writer: DraftWriter | null = null;
  private pending: { payload: DraftPayload; generation: number } | null = null;
  private generation = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private maximum: ReturnType<typeof setTimeout> | undefined;
  private detached = false;
  private committing = false;
  private operation: { generation: number; id: string } | null = null;
  private identity: { id: string; createdAt: string } | null = null;
  private state: DraftControllerState = { status: "idle", error: "" };
  private listeners = new Set<() => void>();
  private repository: DraftRepository;
  constructor(private database: MddDatabase, private context: DraftContext) { this.repository = new DraftRepository(database); }
  getState = () => this.state;
  getId = () => this.snapshot?.metadata.id ?? this.identity?.id;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private report(status: DraftStatus, reason?: unknown) {
    const error = reason instanceof Error ? reason.message : reason ? "Could not keep this draft. Keep this page open." : "";
    if (this.state.status === status && this.state.error === error) return;
    this.state = { status, error };
    if (!this.detached) for (const listener of this.listeners) listener();
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const task = this.tail.catch(() => undefined).then(action); this.tail = task; return task;
  }
  private cancelTimers() { clearTimeout(this.debounce); clearTimeout(this.maximum); this.debounce = undefined; this.maximum = undefined; }
  stage(payload: DraftPayload) {
    if (this.detached) return;
    if (JSON.stringify(this.pending?.payload ?? this.snapshot?.contents.payload) === JSON.stringify(payload)) return;
    this.pending = { payload: structuredClone(payload), generation: ++this.generation };
    // Keep a settled failure visible while typing instead of removing and
    // re-announcing its alert on every subsequent checkpoint attempt.
    if (this.state.status !== "failed") this.report(this.snapshot?.metadata.commitment?.disposition === "copy-only" ? "copy-only" : "keeping");
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => { void this.flush().catch(() => undefined); }, 500);
    this.maximum ??= setTimeout(() => { void this.flush().catch(() => undefined); }, 2000);
  }
  private async candidate(payload: DraftPayload, generation: number): Promise<DraftSnapshot> {
    this.identity ??= { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    const id = this.snapshot?.metadata.id ?? this.identity.id, now = new Date().toISOString();
    return { metadata: this.snapshot ? { ...this.snapshot.metadata, state: "active", updatedAt: now, generation } : {
      id, formatVersion: 1, kind: payload.kind, targetKey: draftTargetKey(payload, id), journalEpoch: await readJournalEpoch(this.database),
      createdAt: this.identity.createdAt, updatedAt: now, generation, state: "active", context: structuredClone(this.context), lineage: null, commitment: null,
    }, contents: { id, generation, payload: structuredClone(payload) } };
  }
  private async keep(pending: { payload: DraftPayload; generation: number }) {
    if (this.snapshot && pending.generation <= this.snapshot.metadata.generation) return;
    const snapshot = await this.candidate(pending.payload, pending.generation);
    if (this.snapshot?.metadata.state === "committed" && this.snapshot.metadata.commitment) {
      await this.repository.checkpointAfterCommit(snapshot, this.snapshot.metadata.generation, this.snapshot.metadata.commitment.operationId);
      this.writer = new DraftWriter(this.repository, snapshot.metadata.id, snapshot.metadata.generation);
    } else {
      this.writer ??= new DraftWriter(this.repository, snapshot.metadata.id);
      await this.writer.checkpoint(snapshot);
    }
    this.snapshot = snapshot;
    if (this.pending?.generation === pending.generation) this.report(snapshot.metadata.commitment?.disposition === "copy-only" ? "copy-only" : "kept");
  }
  flush(): Promise<void> {
    this.cancelTimers();
    const pending = this.pending && structuredClone(this.pending);
    return this.serial(async () => {
      if (!pending) return;
      try { await this.keep(pending); } catch (reason) { this.report("failed", reason); throw reason; }
    });
  }
  async recover(id: string, generation: number): Promise<DraftPayload> {
    return this.serial(async () => {
      if (this.pending || this.snapshot) throw new DraftError("stale", "Keep or discard your current writing before recovering another draft.");
      const fork = await this.repository.forkForRecovery(id, generation);
      this.snapshot = fork; this.pending = { payload: fork.contents.payload, generation: fork.metadata.generation }; this.generation = fork.metadata.generation;
      this.writer = new DraftWriter(this.repository, fork.metadata.id, fork.metadata.generation); this.report("kept");
      return structuredClone(fork.contents.payload);
    });
  }
  discard(mutation?: { tables: readonly PortableTableName[]; action: () => Promise<void> }): Promise<void> {
    this.cancelTimers();
    const generation = this.generation;
    return this.serial(async () => {
      try {
        if (mutation) {
          await this.database.transaction("rw", [...mutation.tables.map(name => this.database.table(name)), this.database.editorDrafts, this.database.editorDraftContents], async () => {
            await mutation.action();
            if (this.snapshot) await this.repository.discard(this.snapshot.metadata.id, this.snapshot.metadata.generation);
          });
        } else if (this.writer) await this.writer.discard();
        if (this.generation !== generation) {
          // The retired ID must never accept a late checkpoint. Keep the newer
          // memory generation as an independent writer and prevent navigation.
          this.snapshot = null; this.writer = null; this.identity = null;
          this.report("keeping");
          throw new DraftError("stale", "Newer writing arrived while discarding. Keep it open.");
        }
        this.snapshot = null; this.writer = null; this.pending = null; this.operation = null; this.identity = null; this.generation = 0; this.report("idle");
      } catch (reason) {
        // Discard/removal failure is reported by the explicit action's dialog.
        // It does not mean a previously acknowledged checkpoint was lost.
        if (this.pending) queueMicrotask(() => { if (!this.detached) void this.flush().catch(() => undefined); });
        throw reason;
      }
    });
  }
  commit<T extends CommittedDraftSaveResult>(save: (context: DraftSaveContext) => Promise<T>, rebase?: Rebase): Promise<T> {
    if (this.committing) return Promise.reject(new DraftError("operation", "A save is already in progress."));
    this.committing = true; this.cancelTimers();
    const pending = this.pending && structuredClone(this.pending);
    return this.serial(async () => {
      if (!pending) throw new DraftError("invalid", "There are no changed values to save.");
      if (this.snapshot?.metadata.commitment?.disposition === "copy-only") throw new DraftError("operation", "This action was already recorded. Copy the remaining writing instead of repeating it.");
      try { await this.keep(pending); } catch (reason) { this.report("failed", reason); }
      // The atomic adapter checks the exact known kept generation again. It can
      // save valid writing without first writing a private body that failed.
      const expectedKeptGeneration = this.snapshot?.metadata.generation ?? null;
      const submitted = this.snapshot?.metadata.generation === pending.generation ? this.snapshot : await this.candidate(pending.payload, pending.generation);
      if (this.operation?.generation !== pending.generation) this.operation = { generation: pending.generation, id: crypto.randomUUID() };
      const result = await save({ snapshot: submitted, operationId: this.operation.id, expectedKeptGeneration });
      // Domain commitment has succeeded. A recovery acknowledgment failure is
      // reported independently and must never turn into Retry mutation.
      try {
        this.snapshot = { ...submitted, metadata: { ...submitted.metadata, commitment: result.marker, state: "committed" } };
        this.writer = new DraftWriter(this.repository, submitted.metadata.id, submitted.metadata.generation);
        const latest = this.pending;
        if (latest && latest.generation > pending.generation) {
          const payload = rebase ? rebase(latest.payload, pending.payload, result) : latest.payload;
          const next = await this.candidate(payload, latest.generation);
          await this.repository.checkpointAfterCommit(next, submitted.metadata.generation, result.marker.operationId);
          const kept = await this.repository.read(next.metadata.id);
          if (kept.kind !== "active") throw new DraftError("stale", "Keep the newer writing open until recovery can refresh.");
          this.snapshot = kept.snapshot;
          if (this.pending?.generation === latest.generation) this.pending = { payload, generation: latest.generation };
          else if (this.pending && rebase) this.pending = { ...this.pending, payload: rebase(this.pending.payload, pending.payload, result) };
          this.writer = new DraftWriter(this.repository, next.metadata.id, latest.generation);
          this.report(result.marker.disposition === "copy-only" ? "copy-only" : "kept");
        } else {
          // Keep the small marker while this editor can still receive input.
          // Detach acknowledges it only after its serialized operations settle.
          this.pending = null; this.operation = null; this.report("idle");
        }
      } catch (reason) { this.report("failed", reason); }
      return result;
    }).finally(() => { this.committing = false; });
  }
  /** Cancel timers, not transactions. Unload remains best-effort; an already
   * acknowledged draft is the restart guarantee, not asynchronous cleanup. */
  detach() {
    this.detached = true; this.cancelTimers();
    void this.tail.catch(() => undefined).then(async () => {
      const snapshot = this.snapshot;
      if (!this.detached || this.pending || snapshot?.metadata.state !== "committed" || !snapshot.metadata.commitment) return;
      await acknowledgeDraftCommit(this.database, snapshot.metadata.id, snapshot.metadata.commitment.operationId);
    }).catch(() => undefined);
  }
  attach() { this.detached = false; }
}
