import type { MddDatabase } from "../data/database";
import { CategoryRepository, PersonRepository } from "../data/repositories/prayer-metadata";
import { CollectionRepository } from "../data/repositories/collections";
import type { Category, Person, Collection, CollectionItem } from "../domain/types";
import { saveWithDraft, type DraftSaveContext, type DraftSaveOperation } from "./commit";
import { DraftError, type DraftPayload } from "./types";

/** Explicit saves only. Each adapter joins the domain operation and retirement
 * of its submitted draft generation in the same transaction. */
export async function saveDirectoryDraft(database: MddDatabase, context: DraftSaveContext) {
  const submitted = context.snapshot.contents.payload;
  const people = new PersonRepository(database), categories = new CategoryRepository(database), collections = new CollectionRepository(database);
  let record: Person | Category | Collection | CollectionItem | undefined;
  let created = false;
  const creation = submitted.kind.endsWith("-create");
  const table = submitted.kind.startsWith("person-") ? "people" : submitted.kind.startsWith("category-") ? "categories" : "collections";
  const operation: DraftSaveOperation = {
    tables: submitted.kind === "collection-item-note" ? ["collections", "collectionItems"] : [table],
    validate: async payload => {
      if (payload.kind !== submitted.kind) throw new DraftError("invalid", "Wrong directory editor.");
      if (!("baseline" in payload) || !payload.baseline) return;
      const current = payload.kind === "collection-item-note" ? await database.collectionItems.get(payload.baseline.id) : await database[table].get(payload.baseline.id);
      if (!current || current.deletedAt || current.revision !== payload.baseline.revision) throw new DraftError("stale", "This saved entry changed or was removed. Review before saving.");
      if (payload.kind === "collection-item-note") {
        const parent = await database.collections.get(payload.collection.id);
        if (!parent || parent.deletedAt || parent.revision !== payload.collection.revision || !("collectionId" in current) || current.collectionId !== parent.id) throw new DraftError("stale", "This collection changed or was removed. Review before saving.");
      }
    },
    save: async payload => {
      switch (payload.kind) {
        case "person-create": record = await people.createPerson(payload.name, payload.relationship, payload.notes); created = true; break;
        case "person-edit": record = await people.updatePerson(payload.baseline.id, payload, payload.baseline.revision); break;
        case "category-create": { const saved = await categories.createCategoryResult(payload.name); record = saved.record; created = saved.created; break; }
        case "category-edit": record = await categories.updateCategory(payload.baseline.id, payload.name, payload.baseline.revision); break;
        case "collection-create": { const existing = (await collections.list()).find(row => row.name.toLocaleLowerCase() === payload.name.trim().toLocaleLowerCase()); record = await collections.create(payload.name); created = !existing; break; }
        case "collection-rename": { const current = await database.collections.get(payload.baseline.id); record = await collections.rename(payload.baseline.id, payload.name, current?.description ?? null, payload.baseline.revision); break; }
        case "collection-item-note": record = await collections.saveItemNote(payload.baseline.id, payload.note, payload.baseline.revision); break;
        default: throw new DraftError("invalid", "This is not a directory editor.");
      }
      return { records: [{id: record.id, revision: record.revision}], disposition: creation ? "copy-only" : "editable" };
    },
    ...(creation ? {} : { rebase: (newer: DraftPayload) => rebaseDirectoryDraft(newer, record!) }),
  };
  const result = await saveWithDraft(database, context, operation);
  // A replay reads the already committed identity; it never repeats creation.
  if (!record) record = submitted.kind === "collection-item-note" ? await database.collectionItems.get(result.marker.records[0]!.id) : await database[table].get(result.marker.records[0]!.id);
  return {...result, record, created};
}

export function rebaseDirectoryDraft(payload: DraftPayload, record: Person | Category | Collection | CollectionItem): DraftPayload {
  const baseline = {id: record.id, revision: record.revision};
  switch (payload.kind) {
    case "person-create": case "person-edit":
      if (!("relationship" in record)) throw new DraftError("invalid", "Wrong saved person.");
      return {...payload, kind: "person-edit", baseline: {...baseline, name: record.name, relationship: record.relationship, notes: record.notes}};
    case "category-create": case "category-edit":
      if (!("name" in record)) throw new DraftError("invalid", "Wrong saved category.");
      return {...payload, kind: "category-edit", baseline: {...baseline, name: record.name}};
    case "collection-create": case "collection-rename":
      if (!("name" in record)) throw new DraftError("invalid", "Wrong saved collection.");
      return {...payload, kind: "collection-rename", baseline: {...baseline, name: record.name}};
    case "collection-item-note":
      if (!("collectionId" in record)) throw new DraftError("invalid", "Wrong saved passage.");
      return {...payload, baseline: {...baseline, note: record.note}};
    default: throw new DraftError("invalid", "Wrong directory writing.");
  }
}
