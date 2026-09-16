import type Dexie from "dexie";
import { schemaV1 } from "./schema";

export const REGISTERED_SCHEMA_VERSIONS = [1] as const;

export function registerDatabaseVersions(database: Dexie): void {
  database.version(1).stores(schemaV1);
}
