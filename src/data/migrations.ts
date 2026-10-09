import type Dexie from "dexie";
import { recoverySchemaV2, recoverySchemaV3, schemaV1 } from "./schema";
import { newJournalState } from "../recovery/journal";

export const REGISTERED_SCHEMA_VERSIONS = [1, 2, 3] as const;

export function registerDatabaseVersions(database: Dexie): void {
  database.version(1).stores(schemaV1);
  database.version(2).stores(recoverySchemaV2).upgrade(async transaction => {
    const metadata = await transaction.table("schemaMetadata").get("database");
    if (metadata && (metadata.schemaVersion > 1 || metadata.contractVersion !== 1)) throw new Error("Local data requires a compatible app update. Nothing has been cleared.");
    await transaction.table("draftJournalState").add(newJournalState());
    if (metadata) await transaction.table("schemaMetadata").put({ ...metadata, schemaVersion: 2, updatedAt: new Date().toISOString() });
  });
  database.version(3).stores(recoverySchemaV3).upgrade(async transaction => {
    const metadata = await transaction.table("schemaMetadata").get("database");
    if (metadata && (metadata.schemaVersion > 2 || metadata.contractVersion !== 1)) throw new Error("Local data requires a compatible app update. Nothing has been cleared.");
    if (metadata) await transaction.table("schemaMetadata").put({ ...metadata, schemaVersion: 3, updatedAt: new Date().toISOString() });
  });
}
