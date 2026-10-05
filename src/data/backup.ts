import type { MddDatabase } from "./database";
import { PORTABLE_SCHEMA_VERSION, PORTABLE_CONTRACT_VERSION, PORTABLE_TABLE_NAMES, portableTables } from "./portable-tables";
import { APP_VERSION } from "../app/version";
import { validateBackupRecords } from "./validation";

export const BACKUP_FORMAT_ID = "mdd-backup";
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  formatId: typeof BACKUP_FORMAT_ID;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  schemaVersion: number;
  contractVersion: number;
  appVersion: string;
  exportedAt: string;
  checksums: { dataSha256: string };
}

export interface BackupSnapshot {
  manifest: BackupManifest;
  data: Record<string, unknown[]>;
}

export function stableDataJson(data: Record<string, unknown[]>): string {
  const ordered = Object.fromEntries(
    Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rows]) => [
        name,
        [...rows].sort((a, b) => {
          const aId = typeof a === "object" && a !== null && "id" in a ? String((a as { id: unknown }).id) : JSON.stringify(a);
          const bId = typeof b === "object" && b !== null && "id" in b ? String((b as { id: unknown }).id) : JSON.stringify(b);
          return aId.localeCompare(bId);
        }),
      ]),
  );
  return JSON.stringify(ordered);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBackupSnapshot(database: MddDatabase, appVersion: string = APP_VERSION): Promise<BackupSnapshot> {
  const data: Record<string, unknown[]> = {};
  const tables = portableTables(database);
  await database.transaction("r", tables, async () => {
    for (const table of tables) data[table.name] = await table.toArray();
  });
  const dataSha256 = await sha256Hex(stableDataJson(data));
  return {
    manifest: {
      formatId: BACKUP_FORMAT_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: PORTABLE_SCHEMA_VERSION,
      contractVersion: PORTABLE_CONTRACT_VERSION,
      appVersion,
      exportedAt: new Date().toISOString(),
      checksums: { dataSha256 },
    },
    data,
  };
}

export async function validateBackupSnapshot(snapshot: BackupSnapshot, database: MddDatabase): Promise<void> {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.manifest || !snapshot.data || typeof snapshot.data !== "object" || Array.isArray(snapshot.data)) throw new Error("Invalid backup snapshot.");
  if (snapshot.manifest.formatId !== BACKUP_FORMAT_ID) throw new Error("Unsupported backup format.");
  if (snapshot.manifest.formatVersion !== BACKUP_FORMAT_VERSION) throw new Error("Unsupported backup version.");
  if (snapshot.manifest.schemaVersion > PORTABLE_SCHEMA_VERSION) throw new Error("Backup was created by a newer database schema.");
  if (snapshot.manifest.schemaVersion !== PORTABLE_SCHEMA_VERSION) throw new Error("Unsupported backup database schema.");
  if (snapshot.manifest.contractVersion !== PORTABLE_CONTRACT_VERSION) throw new Error("Backup domain contract does not match this app.");

  const expectedTables: ReadonlySet<string> = new Set(PORTABLE_TABLE_NAMES);
  for (const name of expectedTables) {
    if (!(name in snapshot.data)) throw new Error(`Backup is missing required table: ${name}`);
  }
  for (const [name, rows] of Object.entries(snapshot.data)) {
    if (!expectedTables.has(name)) throw new Error(`Backup contains unknown table: ${name}`);
    if (!Array.isArray(rows)) throw new Error(`Backup table ${name} is not an array.`);
  }

  const checksum = await sha256Hex(stableDataJson(snapshot.data));
  if (checksum !== snapshot.manifest.checksums.dataSha256) throw new Error("Backup checksum validation failed.");
  validateBackupRecords(snapshot.data);
}

export async function restoreBackupSnapshot(snapshot: BackupSnapshot, database: MddDatabase): Promise<void> {
  await validateBackupSnapshot(snapshot, database);
  const tables = portableTables(database);
  await database.transaction("rw", tables, async () => {
    for (const table of tables) {
      await table.clear();
      const rows = snapshot.data[table.name] ?? [];
      if (rows.length > 0) await table.bulkPut(rows);
    }
  });
}
