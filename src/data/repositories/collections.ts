import { withRemovalCapture } from "../../recovery/removals";
import { assertExpectedRevision } from "../conflicts";
import { newMutableFields, nextMutableFields, nowInstant } from "../../domain/identity";
import type { Collection, CollectionItem, ScriptureReference, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";
import { captureSavedVersion, savedVersionTables } from "../../recovery/saved-versions";

function sameReference(item: CollectionItem, reference: ScriptureReference): boolean {
  return item.translationId === reference.translationId && item.startVerseKey === reference.startVerseKey && item.endVerseKey === reference.endVerseKey;
}

export class CollectionRepository {
  constructor(private readonly database: MddDatabase) {}

  async list(): Promise<Collection[]> {
    return (await this.database.collections.filter((item) => item.deletedAt === null).toArray()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async create(name: string, description: string | null = null): Promise<Collection> {
    return this.database.transaction("rw", this.database.collections, () => this.createInternal(name, description));
  }
  private async createInternal(name: string, description: string | null): Promise<Collection> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Collection name is required.");
    const existing = (await this.list()).find((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (existing) return existing;
    const sortOrder = (await this.list()).reduce((max, item) => Math.max(max, item.sortOrder), -10) + 10;
    const collection: Collection = { ...newMutableFields(), name: normalized, description: description?.trim() || null, sortOrder };
    await this.database.collections.add(collection);
    return collection;
  }

  async rename(id: UUID, name: string, description: string | null = null, expectedRevision?: number): Promise<Collection> {
    return this.database.transaction("rw", [this.database.collections, ...savedVersionTables(this.database)], () => this.renameInternal(id, name, description, expectedRevision));
  }
  private async renameInternal(id: UUID, name: string, description: string | null, expectedRevision?: number): Promise<Collection> {
    const current = await this.database.collections.get(id);
    if (!current || current.deletedAt) throw new Error("Collection not found.");
    assertExpectedRevision(current, expectedRevision);
    const normalized = name.trim();
    if (!normalized) throw new Error("Collection name is required.");
    if ((await this.list()).some((item) => item.id !== id && item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error("A collection with this name already exists.");
    if (normalized === current.name && (description?.trim() || null) === current.description) return current;
    const next: Collection = { ...current, name: normalized, description: description?.trim() || null, ...nextMutableFields(current) };
    await captureSavedVersion(this.database, "collection", current, next);
    await this.database.collections.put(next);
    return next;
  }

  async listItems(collectionId: UUID): Promise<CollectionItem[]> {
    return (await this.database.collectionItems.where("collectionId").equals(collectionId).filter((item) => item.deletedAt === null).toArray()).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async addReference(collectionId: UUID, reference: ScriptureReference, note: string | null = null): Promise<CollectionItem> {
    return this.database.transaction("rw", [this.database.collections, this.database.collectionItems, ...savedVersionTables(this.database)], () => this.addReferenceInternal(collectionId, reference, note));
  }
  private async addReferenceInternal(collectionId: UUID, reference: ScriptureReference, note: string | null): Promise<CollectionItem> {
    const collection = await this.database.collections.get(collectionId);
    if (!collection || collection.deletedAt) throw new Error("Collection not found.");
    const all = await this.database.collectionItems.where("collectionId").equals(collectionId).toArray();
    const existing = all.find((item) => sameReference(item, reference));
    if (existing) {
      if (!existing.deletedAt && (note === null || note.trim() === existing.note)) return existing;
      const restored: CollectionItem = { ...existing, ...reference, note: note?.trim() || existing.note, deletedAt: null, ...nextMutableFields(existing) };
      await captureSavedVersion(this.database, "collection-item", existing, restored);
      await this.database.collectionItems.put(restored);
      return restored;
    }
    const sortOrder = all.filter((item) => item.deletedAt === null).reduce((max, item) => Math.max(max, item.sortOrder), -10) + 10;
    const item: CollectionItem = { ...newMutableFields(), collectionId, ...reference, note: note?.trim() || null, sortOrder };
    await this.database.collectionItems.add(item);
    return item;
  }

  async saveItemNote(id: UUID, note: string, expectedRevision?: number): Promise<CollectionItem> {
    return this.database.transaction("rw", [this.database.collections, this.database.collectionItems, ...savedVersionTables(this.database)], async () => {
      const item = await this.database.collectionItems.get(id);
      const parent = item ? await this.database.collections.get(item.collectionId) : null;
      if (!item || item.deletedAt || !parent || parent.deletedAt) throw new Error("This saved passage is no longer available. Your writing has not been discarded.");
      assertExpectedRevision(item, expectedRevision);
      const normalized = note.trim() || null;
      if (normalized === item.note) return item;
      const saved = { ...item, note: normalized, ...nextMutableFields(item) };
      await captureSavedVersion(this.database, "collection-item", item, saved);
      await this.database.collectionItems.put(saved);
      return saved;
    });
  }

  async removeItem(id: UUID, expectedRevision?: number): Promise<void> {
    return withRemovalCapture(this.database, async () => ({ table: "collectionItems", id }), () => this.removeItemInternalRecovery(id, expectedRevision));
  }
  private async removeItemInternalRecovery(id: UUID, expectedRevision?: number): Promise<void> {
    return this.database.transaction("rw", this.database.collectionItems, async () => {
      const item = await this.database.collectionItems.get(id);
      if (!item || item.deletedAt) return;
      assertExpectedRevision(item, expectedRevision);
      const at = nowInstant();
      await this.database.collectionItems.put({ ...item, deletedAt: at, updatedAt: at, revision: item.revision + 1 });
    });
  }

  async removeCollection(id: UUID, expectedRevision?: number): Promise<void> {
    return withRemovalCapture(this.database, async () => ({ table: "collections", id }), () => this.removeCollectionInternal(id, expectedRevision));
  }
  private async removeCollectionInternal(id: UUID, expectedRevision?: number): Promise<void> {
    const collection = await this.database.collections.get(id);
    if (!collection || collection.deletedAt) return;
    assertExpectedRevision(collection, expectedRevision);
    const at = nowInstant();
    const items = await this.database.collectionItems.where("collectionId").equals(id).filter((item) => item.deletedAt === null).toArray();
    await this.database.transaction("rw", this.database.collections, this.database.collectionItems, async () => {
      await this.database.collections.put({ ...collection, deletedAt: at, updatedAt: at, revision: collection.revision + 1 });
      for (const item of items) await this.database.collectionItems.put({ ...item, deletedAt: at, updatedAt: at, revision: item.revision + 1 });
    });
  }
}
