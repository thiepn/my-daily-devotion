import { newMutableFields } from "../../domain/identity";
import type { Category, Person, UUID } from "../../domain/types";
import type { MddDatabase } from "../database";
import { MutableRepository } from "./mutable-repository";

const DEFAULT_CATEGORIES = ["Personal", "Family", "Friends", "Church", "Mission", "Study/Work", "World"] as const;

export class PersonRepository extends MutableRepository<Person> {
  constructor(private readonly database: MddDatabase) { super(database.people); }

  async list(): Promise<Person[]> {
    return (await this.listActive()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createPerson(name: string, relationship: string | null = null, notes: string | null = null): Promise<Person> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Person name is required.");
    return this.create({ name: normalized, relationship: relationship?.trim() || null, notes: notes?.trim() || null });
  }

  async updatePerson(id: UUID, input: { name: string; relationship?: string | null; notes?: string | null }): Promise<Person> {
    const name = input.name.trim();
    if (!name) throw new Error("Person name is required.");
    return this.patch(id, { name, relationship: input.relationship?.trim() || null, notes: input.notes?.trim() || null });
  }

  async removePerson(id: UUID): Promise<void> {
    const referenced = await this.database.prayers.where("personId").equals(id).filter((prayer) => prayer.deletedAt === null).count();
    if (referenced) throw new Error("Reassign prayers before removing this person.");
    await this.softDelete(id);
  }
}

export class CategoryRepository extends MutableRepository<Category> {
  constructor(private readonly database: MddDatabase) { super(database.categories); }

  async ensureDefaults(): Promise<void> {
    if (await this.database.categories.count()) return;
    await this.database.categories.bulkAdd(DEFAULT_CATEGORIES.map((name, sortOrder) => ({ ...newMutableFields(), name, sortOrder })));
  }

  async list(): Promise<Category[]> {
    await this.ensureDefaults();
    return (await this.listActive()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async createCategory(name: string): Promise<Category> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Category name is required.");
    const existing = (await this.listActive()).find((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
    if (existing) return existing;
    const sortOrder = (await this.listActive()).reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
    return this.create({ name: normalized, sortOrder });
  }

  async updateCategory(id: UUID, name: string): Promise<Category> {
    const normalized = name.trim();
    if (!normalized) throw new Error("Category name is required.");
    return this.patch(id, { name: normalized });
  }

  async removeCategory(id: UUID): Promise<void> {
    const referenced = await this.database.prayers.where("categoryId").equals(id).filter((prayer) => prayer.deletedAt === null).count();
    if (referenced) throw new Error("Reassign prayers before removing this category.");
    await this.softDelete(id);
  }
}
