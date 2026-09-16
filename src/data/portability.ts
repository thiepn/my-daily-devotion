import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createBackupSnapshot, restoreBackupSnapshot, sha256Hex, validateBackupSnapshot, type BackupSnapshot } from "./backup";
import { MddDatabase, prepareDatabase } from "./database";
import { auditDatabase } from "./integrity";
import { DATABASE_SCHEMA_VERSION, DOMAIN_CONTRACT_VERSION } from "./schema";

const FORMAT = "mdd-backup" as const;
const FORMAT_VERSION = 1 as const;
const PBKDF2_ITERATIONS = 310_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 2_000_000;

export interface ArchiveFileEntry { path: string; sha256: string; bytes: number; }
export interface ArchiveEncryption {
  cipher: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  salt: string;
  iv: string;
  kdfParameters: { iterations: number };
}
export interface BackupArchiveManifest {
  format: typeof FORMAT;
  formatVersion: typeof FORMAT_VERSION;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  files: ArchiveFileEntry[];
  encryption: ArchiveEncryption | null;
}
export interface BackupPreview { manifest: BackupArchiveManifest; counts: Record<string, number>; encrypted: boolean; }
export type ImportMode = "merge" | "replace";

function stableDataJson(data: Record<string, unknown[]>): string {
  const ordered = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).map(([name, rows]) => [name, [...rows].sort((a, b) => {
    const aId = typeof a === "object" && a !== null && "id" in a ? String((a as { id: unknown }).id) : typeof a === "object" && a !== null && "key" in a ? String((a as { key: unknown }).key) : JSON.stringify(a);
    const bId = typeof b === "object" && b !== null && "id" in b ? String((b as { id: unknown }).id) : typeof b === "object" && b !== null && "key" in b ? String((b as { key: unknown }).key) : JSON.stringify(b);
    return aId.localeCompare(bId);
  })]));
  return JSON.stringify(ordered);
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", ownedArrayBuffer(bytes));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function randomBytes(length: number): Uint8Array { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return bytes; }
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)));
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i); return bytes; }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", ownedArrayBuffer(new TextEncoder().encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: ownedArrayBuffer(salt), iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptBytes(plain: Uint8Array, password: string): Promise<{ payload: Uint8Array; encryption: ArchiveEncryption }> {
  if (password.length < 8) throw new Error("Encrypted backups require a password of at least 8 characters.");
  const salt = randomBytes(16); const iv = randomBytes(12); const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ownedArrayBuffer(iv) }, key, ownedArrayBuffer(plain)));
  return { payload: strToU8(JSON.stringify({ ciphertext: toBase64(cipher) })), encryption: { cipher: "AES-GCM", kdf: "PBKDF2-SHA-256", salt: toBase64(salt), iv: toBase64(iv), kdfParameters: { iterations: PBKDF2_ITERATIONS } } };
}

async function decryptBytes(payload: Uint8Array, password: string, encryption: ArchiveEncryption): Promise<Uint8Array> {
  if (!password) throw new Error("This backup is encrypted. Enter its password.");
  let envelope: { ciphertext?: string };
  try { envelope = JSON.parse(strFromU8(payload)) as { ciphertext?: string }; } catch { throw new Error("Encrypted backup payload is invalid."); }
  if (typeof envelope.ciphertext !== "string" || !envelope.ciphertext) throw new Error("Encrypted backup payload is invalid.");
  let cipher: Uint8Array;
  try { cipher = fromBase64(envelope.ciphertext); } catch { throw new Error("Encrypted backup payload is invalid."); }
  const key = await deriveKey(password, fromBase64(encryption.salt), encryption.kdfParameters.iterations);
  try {
    return new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ownedArrayBuffer(fromBase64(encryption.iv)) },
      key,
      ownedArrayBuffer(cipher),
    ));
  } catch {
    throw new Error("Backup password is incorrect or the encrypted data is damaged.");
  }
}

function validateArchiveManifest(value: unknown): asserts value is BackupArchiveManifest {
  if (!record(value)) throw new Error("Backup manifest is missing.");
  if (value.format !== FORMAT || value.formatVersion !== FORMAT_VERSION) throw new Error("Unsupported MDD backup format.");
  if (typeof value.appVersion !== "string" || !value.appVersion.trim()) throw new Error("Backup manifest has an invalid app version.");
  if (!Number.isInteger(value.schemaVersion) || (value.schemaVersion as number) < 1) throw new Error("Backup manifest has an invalid database schema version.");
  if ((value.schemaVersion as number) > DATABASE_SCHEMA_VERSION) throw new Error("Backup uses a newer database schema.");
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error("Backup manifest has an invalid export timestamp.");
  if (!Array.isArray(value.files) || value.files.length === 0) throw new Error("Backup manifest does not describe payload files.");

  const paths = new Set<string>();
  for (const rawEntry of value.files) {
    if (!record(rawEntry)) throw new Error("Backup manifest contains an invalid file entry.");
    const path = rawEntry.path;
    if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === "" || part === "." || part === "..")) throw new Error("Backup manifest contains an invalid file path.");
    if (paths.has(path)) throw new Error(`Backup manifest contains a duplicate file entry: ${path}`);
    paths.add(path);
    if (typeof rawEntry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(rawEntry.sha256)) throw new Error(`Backup manifest has an invalid checksum for ${path}.`);
    if (!Number.isInteger(rawEntry.bytes) || (rawEntry.bytes as number) < 0) throw new Error(`Backup manifest has an invalid byte count for ${path}.`);
  }
  if (!paths.has("data.json")) throw new Error("Backup manifest does not describe data.json.");

  const encryption = value.encryption;
  if (encryption !== undefined && encryption !== null) {
    if (!record(encryption) || encryption.cipher !== "AES-GCM" || encryption.kdf !== "PBKDF2-SHA-256") throw new Error("Backup uses unsupported encryption metadata.");
    if (typeof encryption.salt !== "string" || typeof encryption.iv !== "string" || !record(encryption.kdfParameters)) throw new Error("Backup encryption metadata is incomplete.");
    const iterations = encryption.kdfParameters.iterations;
    if (!Number.isInteger(iterations) || (iterations as number) < MIN_PBKDF2_ITERATIONS || (iterations as number) > MAX_PBKDF2_ITERATIONS) throw new Error("Backup uses unsupported PBKDF2 parameters.");
    let salt: Uint8Array; let iv: Uint8Array;
    try { salt = fromBase64(encryption.salt); iv = fromBase64(encryption.iv); } catch { throw new Error("Backup encryption metadata is invalid."); }
    if (salt.byteLength < 16 || salt.byteLength > 64 || iv.byteLength !== 12) throw new Error("Backup encryption metadata is invalid.");
  }
}

async function verifyArchiveFiles(files: Record<string, Uint8Array>, manifest: BackupArchiveManifest): Promise<void> {
  const declared = new Set(manifest.files.map((item) => item.path));
  for (const entry of manifest.files) {
    const payload = files[entry.path];
    if (!payload) throw new Error(`Backup is missing declared payload file: ${entry.path}`);
    if (entry.bytes !== payload.byteLength || entry.sha256 !== await sha256Bytes(payload)) throw new Error(`Backup archive checksum validation failed for ${entry.path}.`);
  }
  for (const path of Object.keys(files)) {
    if (path === "manifest.json" || path.endsWith("/")) continue;
    if (!declared.has(path)) throw new Error(`Backup contains an undeclared payload file: ${path}`);
  }
}

export async function createMddBackup(database: MddDatabase, appVersion = "0.8.0", password?: string): Promise<Uint8Array> {
  const snapshot = await createBackupSnapshot(database, appVersion);
  const plain = strToU8(stableDataJson(snapshot.data));
  const encrypted = password ? await encryptBytes(plain, password) : null;
  const dataBytes = encrypted?.payload ?? plain;
  const manifest: BackupArchiveManifest = {
    format: FORMAT, formatVersion: FORMAT_VERSION, appVersion, schemaVersion: snapshot.manifest.schemaVersion, exportedAt: snapshot.manifest.exportedAt,
    files: [{ path: "data.json", sha256: await sha256Bytes(dataBytes), bytes: dataBytes.byteLength }], encryption: encrypted?.encryption ?? null,
  };
  return zipSync({ "manifest.json": strToU8(JSON.stringify(manifest, null, 2)), "data.json": dataBytes }, { level: 6 });
}

async function readArchive(bytes: Uint8Array, password: string, database: MddDatabase): Promise<{ manifest: BackupArchiveManifest; snapshot: BackupSnapshot }> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { throw new Error("This file is not a valid .mddbackup archive."); }
  const manifestBytes = files["manifest.json"]; const dataBytes = files["data.json"];
  if (!manifestBytes || !dataBytes) throw new Error("Backup must contain manifest.json and data.json.");
  let manifestValue: unknown;
  try { manifestValue = JSON.parse(strFromU8(manifestBytes)) as unknown; } catch { throw new Error("Backup manifest.json is invalid."); }
  validateArchiveManifest(manifestValue);
  const manifest = manifestValue;
  await verifyArchiveFiles(files, manifest);
  const plain = manifest.encryption ? await decryptBytes(dataBytes, password, manifest.encryption) : dataBytes;
  let data: Record<string, unknown[]>;
  try { data = JSON.parse(strFromU8(plain)) as Record<string, unknown[]>; } catch { throw new Error("Backup data.json is invalid."); }
  const snapshot: BackupSnapshot = {
    manifest: { formatId: FORMAT, formatVersion: FORMAT_VERSION, schemaVersion: manifest.schemaVersion, contractVersion: DOMAIN_CONTRACT_VERSION, appVersion: manifest.appVersion, exportedAt: manifest.exportedAt, checksums: { dataSha256: await sha256Hex(stableDataJson(data)) } }, data,
  };
  await validateBackupSnapshot(snapshot, database);
  return { manifest, snapshot };
}

async function validateInTemporaryDatabase(snapshot: BackupSnapshot): Promise<void> {
  const temp = new MddDatabase(`mdd-import-validation-${crypto.randomUUID()}`);
  try {
    await prepareDatabase(temp);
    await restoreBackupSnapshot(snapshot, temp);
    const report = await auditDatabase(temp);
    if (!report.ok) throw new Error(`Backup failed relational integrity checks: ${report.issues.map((item) => item.code).join(", ")}`);
  } finally { temp.close(); await temp.delete(); }
}

function rowKey(row: unknown): string {
  if (row && typeof row === "object" && "id" in row) return `id:${String((row as { id: unknown }).id)}`;
  if (row && typeof row === "object" && "key" in row) return `key:${String((row as { key: unknown }).key)}`;
  return `value:${JSON.stringify(row)}`;
}
function incomingWins(local: unknown, incoming: unknown): boolean {
  if (!local || typeof local !== "object" || !incoming || typeof incoming !== "object") return false;
  const l = local as { revision?: unknown; updatedAt?: unknown }; const i = incoming as { revision?: unknown; updatedAt?: unknown };
  if (typeof l.revision === "number" && typeof i.revision === "number") return i.revision > l.revision;
  if (typeof l.updatedAt === "string" && typeof i.updatedAt === "string") return i.updatedAt > l.updatedAt;
  return false;
}

async function mergedSnapshot(incoming: BackupSnapshot, database: MddDatabase): Promise<BackupSnapshot> {
  const local = await createBackupSnapshot(database, "0.8.0");
  const data: Record<string, unknown[]> = {};
  for (const name of Object.keys(local.data)) {
    const map = new Map((local.data[name] ?? []).map((row) => [rowKey(row), row]));
    for (const row of incoming.data[name] ?? []) {
      const key = rowKey(row); const current = map.get(key);
      if (current === undefined || incomingWins(current, row)) map.set(key, row);
    }
    data[name] = [...map.values()];
  }
  return { manifest: { ...incoming.manifest, checksums: { dataSha256: await sha256Hex(stableDataJson(data)) } }, data };
}

export async function previewMddBackup(bytes: Uint8Array, password: string, database: MddDatabase): Promise<BackupPreview> {
  const { manifest, snapshot } = await readArchive(bytes, password, database);
  await validateInTemporaryDatabase(snapshot);
  return { manifest, counts: Object.fromEntries(Object.entries(snapshot.data).map(([name, rows]) => [name, rows.length])), encrypted: Boolean(manifest.encryption) };
}

export async function importMddBackup(bytes: Uint8Array, password: string, mode: ImportMode, database: MddDatabase): Promise<void> {
  const { snapshot } = await readArchive(bytes, password, database);
  const candidate = mode === "merge" ? await mergedSnapshot(snapshot, database) : snapshot;
  await validateInTemporaryDatabase(candidate);
  await restoreBackupSnapshot(candidate, database);
}

function safeMarkdown(value: string): string { return value.replace(/\r\n/g, "\n").trim(); }
function pathSafe(value: string): string { return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80); }

export async function createMarkdownArchive(database: MddDatabase): Promise<Uint8Array> {
  const snapshot = await createBackupSnapshot(database, "0.8.0");
  const files: Record<string, Uint8Array> = { "README.md": strToU8("# My Daily Devotion archive\n\nHuman-readable export. `data.json` contains the complete machine-readable local data snapshot.\n"), "data.json": strToU8(stableDataJson(snapshot.data)) };
  const reflections = await database.reflections.filter((item) => item.deletedAt === null).toArray();
  for (const reflection of reflections) files[`Reflections/${reflection.localDate.slice(0, 4)}/${reflection.localDate}.md`] = strToU8(`# ${reflection.localDate}\n\n${safeMarkdown(reflection.bodyMd)}\n`);
  const prayers = await database.prayers.filter((item) => item.deletedAt === null).toArray();
  for (const status of ["ACTIVE", "WAITING", "ANSWERED", "ARCHIVED"] as const) {
    const lines = [`# ${status[0]}${status.slice(1).toLowerCase()} prayers`, ""];
    for (const prayer of prayers.filter((item) => item.status === status)) {
      lines.push(`## ${prayer.body}`, "", `Created: ${prayer.createdAt}`, prayer.lastPrayedAt ? `Last prayed: ${prayer.lastPrayedAt}` : "", "");
      const updates = await database.prayerUpdates.where("prayerId").equals(prayer.id).filter((item) => item.deletedAt === null).sortBy("occurredAt");
      for (const update of updates) lines.push(`- **${update.type}** (${update.occurredAt}): ${update.body}`);
      const resolution = await database.prayerResolutions.where("prayerId").equals(prayer.id).first();
      if (resolution && !resolution.deletedAt) lines.push("", `Answered: ${resolution.answeredAt}`, resolution.reflectionMd ? safeMarkdown(resolution.reflectionMd) : "");
      lines.push("");
    }
    files[`Prayers/${pathSafe(status[0] + status.slice(1).toLowerCase())}.md`] = strToU8(lines.filter((line) => line !== undefined).join("\n"));
  }
  const highlights = await database.highlights.filter((item) => item.deletedAt === null).toArray();
  files["Scripture/Highlights.md"] = strToU8(["# Highlights", "", ...highlights.map((item) => `- ${item.startVerseKey}${item.endVerseKey !== item.startVerseKey ? `–${item.endVerseKey}` : ""}`)].join("\n"));
  const notes = await database.verseNotes.filter((item) => item.deletedAt === null).toArray();
  files["Scripture/Verse Notes.md"] = strToU8(["# Verse Notes", "", ...notes.flatMap((item) => [`## ${item.startVerseKey}${item.endVerseKey !== item.startVerseKey ? `–${item.endVerseKey}` : ""}`, "", safeMarkdown(item.bodyMd), ""])].join("\n"));
  return zipSync(files, { level: 6 });
}
