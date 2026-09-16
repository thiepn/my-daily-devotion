import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import type { Collection, CollectionItem, ScriptureReference, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";

function sameReference(item: CollectionItem, reference: ScriptureReference): boolean {
  return item.translationId === reference.translationId && item.startVerseKey === reference.startVerseKey && item.endVerseKey === reference.endVerseKey;
}

export class CollectionRepository {
  constructor(private readonly database: MddDatabase) {}

  async list(): Promise<Collection[]> {
    return (await this.database.collections.filter((item) => item.deletedAt === null).toArray()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async create(name: string, description: string | null = null): Promise<Collection> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Collection name is required.");
    const existing = (await this.list()).find((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (existing) return existing;
    const sortOrder = (await this.list()).reduce((max, item) => Math.max(max, item.sortOrder), -10) + 10;
    const collection: Collection = { ...newMutableFields(), name: normalized, description: description?.trim() || null, sortOrder };
    await this.database.collections.add(collection);
    return collection;
  }

  async rename(id: UUID, name: string, description: string | null = null): Promise<Collection> {
    const current = await this.database.collections.get(id);
    if (!current || current.deletedAt) throw new Error("Collection not found.");
    const normalized = name.trim();
    if (!normalized) throw new Error("Collection name is required.");
    const next: Collection = { ...current, name: normalized, description: description?.trim() || null, ...nextMutableFields(current) };
    await this.database.collections.put(next);
    return next;
  }

  async listItems(collectionId: UUID): Promise<CollectionItem[]> {
    return (await this.database.collectionItems.where("collectionId").equals(collectionId).filter((item) => item.deletedAt === null).toArray()).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  async addReference(collectionId: UUID, reference: ScriptureReference, note: string | null = null): Promise<CollectionItem> {
    const collection = await this.database.collections.get(collectionId);
    if (!collection || collection.deletedAt) throw new Error("Collection not found.");
    const all = await this.database.collectionItems.where("collectionId").equals(collectionId).toArray();
    const existing = all.find((item) => sameReference(item, reference));
    if (existing) {
      if (!existing.deletedAt && (note === null || note.trim() === existing.note)) return existing;
      const restored: CollectionItem = { ...existing, ...reference, note: note?.trim() || existing.note, deletedAt: null, ...nextMutableFields(existing) };
      await this.database.collectionItems.put(restored);
      return restored;
    }
    const sortOrder = all.filter((item) => item.deletedAt === null).reduce((max, item) => Math.max(max, item.sortOrder), -10) + 10;
    const item: CollectionItem = { ...newMutableFields(), collectionId, ...reference, note: note?.trim() || null, sortOrder };
    await this.database.collectionItems.add(item);
    return item;
  }

  async removeItem(id: UUID): Promise<void> {
    const item = await this.database.collectionItems.get(id);
    if (!item || item.deletedAt) return;
    const at = nowInstant();
    await this.database.collectionItems.put({ ...item, deletedAt: at, updatedAt: at, revision: item.revision + 1 });
  }

  async removeCollection(id: UUID): Promise<void> {
    const collection = await this.database.collections.get(id);
    if (!collection || collection.deletedAt) return;
    const at = nowInstant();
    const items = await this.database.collectionItems.where("collectionId").equals(id).filter((item) => item.deletedAt === null).toArray();
    await this.database.transaction("rw", this.database.collections, this.database.collectionItems, async () => {
      await this.database.collections.put({ ...collection, deletedAt: at, updatedAt: at, revision: collection.revision + 1 });
      for (const item of items) await this.database.collectionItems.put({ ...item, deletedAt: at, updatedAt: at, revision: item.revision + 1 });
    });
  }
}
