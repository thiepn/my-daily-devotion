import type { EntityTable } from "dexie";
import { assertExpectedRevision } from "../conflicts";
import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import type { MutableEntity, UUID } from "../../domain/types";

type CreateInput<T extends MutableEntity> = Omit<T, keyof MutableEntity>;

export class MutableRepository<T extends MutableEntity> {
  constructor(protected readonly table: EntityTable<T, "id">) {}

  async create(input: CreateInput<T>): Promise<T> {
    const entity = { ...input, ...newMutableFields() } as T;
    await this.table.add(entity);
    return entity;
  }

  async get(id: UUID, includeDeleted = false): Promise<T | undefined> {
    const entity = await this.table.where("id").equals(id).first();
    if (!entity || (!includeDeleted && entity.deletedAt)) return undefined;
    return entity;
  }

  async listActive(): Promise<T[]> {
    return this.table.filter((entity) => entity.deletedAt === null).toArray();
  }

  async patch(id: UUID, patch: Partial<Omit<T, keyof MutableEntity | "id">>, expectedRevision?: number): Promise<T> {
    return this.table.db.transaction("rw", this.table, async () => {
    const current = await this.require(id);
    assertExpectedRevision(current, expectedRevision);
    const next = {
      ...current,
      ...patch,
      ...nextMutableFields(current),
      id: current.id,
      createdAt: current.createdAt,
      deletedAt: current.deletedAt,
    } as T;
    await this.table.put(next);
    return next;
    });
  }

  async softDelete(id: UUID): Promise<T> {
    return this.table.db.transaction("rw", this.table, async () => {
    const current = await this.require(id);
    const at = nowInstant();
    const next = {
      ...current,
      deletedAt: at,
      updatedAt: at,
      revision: current.revision + 1,
    } as T;
    await this.table.put(next);
    return next;
    });
  }

  protected async require(id: UUID): Promise<T> {
    const entity = await this.table.where("id").equals(id).first();
    if (!entity || entity.deletedAt) throw new Error(`Record not found: ${id}`);
    return entity;
  }
}
