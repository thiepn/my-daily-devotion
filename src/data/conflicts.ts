import type { MutableEntity } from "../domain/types";

export class EditConflictError extends Error {
  constructor() {
    super("This record changed in another tab. Your edits are still here; review the latest saved version before continuing.");
    this.name = "EditConflictError";
  }
}
export function assertExpectedRevision(record: MutableEntity, expectedRevision?: number): void {
  if (expectedRevision !== undefined && record.revision !== expectedRevision) throw new EditConflictError();
}
export function isEditConflict(error: unknown): boolean {
  return error instanceof EditConflictError || (error instanceof Error && /another tab/.test(error.message));
}
