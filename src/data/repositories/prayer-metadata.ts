import { newMutableFields } from "../../domain/identity";
import type { Category, Person, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";
import { MutableRepository } from "./mutable-repository";
import { assertExpectedRevision } from "../conflicts";

export const DEFAULT_CATEGORIES = ["Personal", "Family", "Friends", "Church", "Mission", "Study/Work", "World"] as const;

export class MetadataReferencedError extends Error {
  constructor(public readonly count: number) {
    super("This entry is used by saved prayers. Reassign active or waiting prayers in Prayer Settings; answered and archived prayers retain their links.");
    this.name = "MetadataReferencedError";
  }
}

export class PersonRepository extends MutableRepository<Person> {
  constructor(private readonly database: MddDatabase) { super(database.people); }

  async list(): Promise<Person[]> {
    return (await this.listActive()).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async createPerson(name: string, relationship: string | null = null, notes: string | null = null): Promise<Person> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Person name is required.");
    return this.create({ name: normalized, relationship: relationship?.trim() || null, notes: notes?.trim() || null });
  }

  async updatePerson(id: UUID, input: { name: string; relationship?: string | null; notes?: string | null }, expectedRevision?: number): Promise<Person> {
    const name = input.name.trim();
    if (!name) throw new Error("Person name is required.");
    return this.database.transaction("rw", this.database.people, async () => {
      const current = await this.require(id);
      assertExpectedRevision(current, expectedRevision);
      const patch = { name, relationship: input.relationship?.trim() || null, notes: input.notes?.trim() || null };
      if (current.name === patch.name && current.relationship === patch.relationship && current.notes === patch.notes) return current;
      return this.patch(id, patch, expectedRevision);
    });
  }

  async removePerson(id: UUID, expectedRevision?: number): Promise<void> {
    return this.database.transaction("rw", this.database.people, this.database.prayers, () => this.removePersonInternal(id, expectedRevision));
  }
  private async removePersonInternal(id: UUID, expectedRevision?: number): Promise<void> {
    assertExpectedRevision(await this.require(id), expectedRevision);
    const referenced = await this.database.prayers.where("personId").equals(id).filter((prayer) => prayer.deletedAt === null).count();
    if (referenced) throw new MetadataReferencedError(referenced);
    await this.softDelete(id);
  }
}

export class CategoryRepository extends MutableRepository<Category> {
  constructor(private readonly database: MddDatabase) { super(database.categories); }

  async ensureDefaults(): Promise<void> {
    return this.database.transaction("rw", this.database.categories, () => this.ensureDefaultsInternal());
  }
  private async ensureDefaultsInternal(): Promise<void> {
    if (await this.database.categories.count()) return;
    await this.database.categories.bulkAdd(DEFAULT_CATEGORIES.map((name, sortOrder) => ({ ...newMutableFields(), name, sortOrder })));
  }

  async list(): Promise<Category[]> {
    return (await this.listActive()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  async createCategory(name: string): Promise<Category> {
    return (await this.createCategoryResult(name)).record;
  }
  async createCategoryResult(name: string): Promise<{ record: Category; created: boolean }> {
    return this.database.transaction("rw", this.database.categories, () => this.createCategoryInternal(name));
  }
  private async createCategoryInternal(name: string): Promise<{ record: Category; created: boolean }> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Category name is required.");
    const existing = (await this.listActive()).find((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (existing) return { record: existing, created: false };
    const sortOrder = (await this.listActive()).reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
    return { record: await this.create({ name: normalized, sortOrder }), created: true };
  }

  async updateCategory(id: UUID, name: string, expectedRevision?: number): Promise<Category> {
    return this.database.transaction("rw", this.database.categories, () => this.updateCategoryInternal(id, name, expectedRevision));
  }
  private async updateCategoryInternal(id: UUID, name: string, expectedRevision?: number): Promise<Category> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Category name is required.");
    const current = await this.require(id);
    assertExpectedRevision(current, expectedRevision);
    if ((await this.listActive()).some((item) => item.id !== id && item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error("A category with this name already exists.");
    if (current.name === normalized) return current;
    return this.patch(id, { name: normalized }, expectedRevision);
  }

  async removeCategory(id: UUID, expectedRevision?: number): Promise<void> {
    return this.database.transaction("rw", this.database.categories, this.database.prayers, () => this.removeCategoryInternal(id, expectedRevision));
  }
  private async removeCategoryInternal(id: UUID, expectedRevision?: number): Promise<void> {
    assertExpectedRevision(await this.require(id), expectedRevision);
    const referenced = await this.database.prayers.where("categoryId").equals(id).filter((prayer) => prayer.deletedAt === null).count();
    if (referenced) throw new MetadataReferencedError(referenced);
    await this.softDelete(id);
  }
}
