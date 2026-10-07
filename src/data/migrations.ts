import type Dexie from "dexie";
import { recoverySchemaV2, schemaV1 } from "./schema";
import { newJournalState } from "../recovery/journal";

export const REGISTERED_SCHEMA_VERSIONS = [1, 2] as const;

export function registerDatabaseVersions(database: Dexie): void {
  database.version(1).stores(schemaV1);
  database.version(2).stores(recoverySchemaV2).upgrade(async transaction => {
    const metadata = await transaction.table("schemaMetadata").get("database");
    if (metadata && (metadata.schemaVersion > 1 || metadata.contractVersion !== 1)) throw new Error("Local data requires a compatible app update. Nothing has been cleared.");
    await transaction.table("draftJournalState").add(newJournalState());
    if (metadata) await transaction.table("schemaMetadata").put({ ...metadata, schemaVersion: 2, updatedAt: new Date().toISOString() });
  });
}
