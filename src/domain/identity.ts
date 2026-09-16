import type { Instant, MutableEntity, UUID } from "./types";

export function createId(): UUID {
  return crypto.randomUUID();
}

export function nowInstant(): Instant {
  return new Date().toISOString() as Instant;
}

export function newMutableFields(at: Instant = nowInstant()): Pick<MutableEntity, "id" | "createdAt" | "updatedAt" | "revision" | "deletedAt"> {
  return { id: createId(), createdAt: at, updatedAt: at, revision: 1, deletedAt: null };
}

export function nextMutableFields(entity: MutableEntity, at: Instant = nowInstant()): Pick<MutableEntity, "updatedAt" | "revision"> {
  return { updatedAt: at, revision: entity.revision + 1 };
}
