import { DraftRepository } from "./repository";
import { DraftError, type DraftSnapshot } from "./types";

/** One editor owns one writer. Timers belong to the later editor hook; this
 * barrier orders storage acknowledgments, navigation flushes and discard. */
export class DraftWriter {
  private tail: Promise<void> = Promise.resolve();
  private expectedGeneration: number | null;
  private closing = false;
  constructor(private readonly repository: DraftRepository, private readonly id: string, generation: number | null = null) { this.expectedGeneration = generation; }

  checkpoint(snapshot: DraftSnapshot): Promise<void> {
    if (this.closing || snapshot.metadata.id !== this.id) return Promise.reject(new DraftError("retired", "This editor writer is closed."));
    const captured = structuredClone(snapshot);
    const next = this.tail.catch(() => undefined).then(async () => {
      await this.repository.persist(captured, this.expectedGeneration);
      this.expectedGeneration = captured.metadata.generation;
    });
    this.tail = next;
    return next;
  }
  flush(): Promise<void> { return this.tail; }
  async discard(): Promise<void> {
    this.closing = true;
    // Writes already handed to storage settle before retirement. New writes
    // reject immediately, so a late callback cannot resurrect the draft.
    await this.tail.catch(() => undefined);
    if (this.expectedGeneration !== null) await this.repository.discard(this.id, this.expectedGeneration);
  }
}
