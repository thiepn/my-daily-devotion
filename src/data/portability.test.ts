import { afterEach, describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { sha256Hex } from "./backup";
import { MddDatabase, prepareDatabase } from "./database";
import { createMarkdownArchive, createMddBackup, importMddBackup, previewMddBackup } from "./portability";
import { PrayerRepository } from "./repositories/prayers";
import { ReflectionRepository } from "./repositories/reflections";
import type { Instant, LocalDate } from "../domain/types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase { const database = new MddDatabase(`mdd-portability-test-${crypto.randomUUID()}`); databases.push(database); return database; }
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

describe("MDD portability", () => {
  it("round-trips a plain .mddbackup through preview and replace", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    const prayer = await new PrayerRepository(source).createPrayer({ body: "Preserve this request" });
    const bytes = await createMddBackup(source, "0.8.0");
    const preview = await previewMddBackup(bytes, "", target);
    expect(preview.encrypted).toBe(false); expect(preview.counts.prayers).toBe(1);
    await importMddBackup(bytes, "", "replace", target);
    expect(await target.prayers.get(prayer.id)).toMatchObject({ body: "Preserve this request" });
  });

  it("replace removes local-only records after the candidate is validated", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    const incoming = await new PrayerRepository(source).createPrayer({ body: "Incoming replacement" });
    const localOnly = await new PrayerRepository(target).createPrayer({ body: "Local-only request" });
    const bytes = await createMddBackup(source, "0.8.0");
    await importMddBackup(bytes, "", "replace", target);
    expect(await target.prayers.get(incoming.id)).toBeDefined();
    expect(await target.prayers.get(localOnly.id)).toBeUndefined();
  });

  it("encrypts sensitive data with a password and rejects a wrong password", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    const prayer = await new PrayerRepository(source).createPrayer({ body: "Private request" });
    const bytes = await createMddBackup(source, "0.8.0", "correct-horse-battery");
    await expect(previewMddBackup(bytes, "wrong-password", target)).rejects.toThrow(/password|damaged/i);
    const preview = await previewMddBackup(bytes, "correct-horse-battery", target);
    expect(preview.encrypted).toBe(true);
    await importMddBackup(bytes, "correct-horse-battery", "replace", target);
    expect(await target.prayers.get(prayer.id)).toMatchObject({ body: "Private request" });
  });

  it("merge keeps a newer local revision while importing missing records", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    const sourceRepo = new PrayerRepository(source);
    const shared = await sourceRepo.createPrayer({ body: "Older incoming wording" });
    const incomingOnly = await sourceRepo.createPrayer({ body: "Incoming-only request" });
    const bytes = await createMddBackup(source, "0.8.0");
    await target.prayers.put({ ...shared, body: "Newer local wording", revision: 9, updatedAt: "2026-09-16T22:00:00.000Z" as Instant });
    await importMddBackup(bytes, "", "merge", target);
    expect((await target.prayers.get(shared.id))?.body).toBe("Newer local wording");
    expect((await target.prayers.get(incomingOnly.id))?.body).toBe("Incoming-only request");
  });

  it("merge accepts a newer incoming revision", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    const shared = await new PrayerRepository(source).createPrayer({ body: "Newest incoming wording" });
    await source.prayers.put({ ...shared, revision: 8, updatedAt: "2026-09-16T23:00:00.000Z" as Instant });
    await target.prayers.put({ ...shared, body: "Older local wording", revision: 2, updatedAt: "2026-09-16T21:00:00.000Z" as Instant });
    const bytes = await createMddBackup(source, "0.8.0");
    await importMddBackup(bytes, "", "merge", target);
    expect((await target.prayers.get(shared.id))?.body).toBe("Newest incoming wording");
    expect((await target.prayers.get(shared.id))?.revision).toBe(8);
  });

  it("merge preserves a newer incoming tombstone", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    const shared = await new PrayerRepository(source).createPrayer({ body: "Delete me in the incoming archive" });
    const deletedAt = "2026-09-16T23:30:00.000Z" as Instant;
    await source.prayers.put({ ...shared, revision: 5, updatedAt: deletedAt, deletedAt });
    await target.prayers.put({ ...shared, revision: 2, updatedAt: "2026-09-16T21:00:00.000Z" as Instant, deletedAt: null });
    const bytes = await createMddBackup(source, "0.8.0");
    await importMddBackup(bytes, "", "merge", target);
    expect((await target.prayers.get(shared.id))?.deletedAt).toBe(deletedAt);
    expect((await target.prayers.get(shared.id))?.revision).toBe(5);
  });

  it("rejects archive tampering before current data is replaced", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    await new PrayerRepository(source).createPrayer({ body: "Incoming" });
    const protectedPrayer = await new PrayerRepository(target).createPrayer({ body: "Keep me" });
    const files = unzipSync(await createMddBackup(source, "0.8.0"));
    files["data.json"] = strToU8("{\"tampered\":true}");
    const tampered = zipSync(files);
    await expect(importMddBackup(tampered, "", "replace", target)).rejects.toThrow(/checksum/i);
    expect(await target.prayers.get(protectedPrayer.id)).toBeDefined();
  });

  it("rejects a checksum-valid but relationally invalid candidate before live mutation", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    await new PrayerRepository(source).createPrayer({ body: "Incoming with broken relation" });
    const protectedPrayer = await new PrayerRepository(target).createPrayer({ body: "Keep current data intact" });
    const files = unzipSync(await createMddBackup(source, "0.8.0"));
    const data = JSON.parse(strFromU8(files["data.json"]!)) as Record<string, unknown[]>;
    const prayer = data.prayers?.[0] as Record<string, unknown> | undefined;
    if (!prayer) throw new Error("Expected prayer fixture in backup.");
    prayer.personId = "missing-person";
    const dataText = JSON.stringify(data);
    const dataBytes = strToU8(dataText);
    files["data.json"] = dataBytes;
    const manifest = JSON.parse(strFromU8(files["manifest.json"]!)) as { files: Array<{ path: string; sha256: string; bytes: number }> };
    const entry = manifest.files.find((item) => item.path === "data.json");
    if (!entry) throw new Error("Expected data.json manifest entry.");
    entry.bytes = dataBytes.byteLength;
    entry.sha256 = await sha256Hex(dataText);
    files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    const invalid = zipSync(files);
    await expect(importMddBackup(invalid, "", "replace", target)).rejects.toThrow(/ORPHAN_PRAYER_PERSON/i);
    expect(await target.prayers.get(protectedPrayer.id)).toBeDefined();
  });

  it("rejects a backup from a newer schema without touching live data", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    await new PrayerRepository(source).createPrayer({ body: "Future schema request" });
    const protectedPrayer = await new PrayerRepository(target).createPrayer({ body: "Current request" });
    const files = unzipSync(await createMddBackup(source, "0.8.0"));
    const manifest = JSON.parse(strFromU8(files["manifest.json"]!)) as { schemaVersion: number };
    manifest.schemaVersion = 999;
    files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
    await expect(importMddBackup(zipSync(files), "", "replace", target)).rejects.toThrow(/newer database schema/i);
    expect(await target.prayers.get(protectedPrayer.id)).toBeDefined();
  });

  it("produces a human-readable Markdown archive alongside data.json", async () => {
    const database = testDb(); await prepareDatabase(database);
    await new ReflectionRepository(database).saveDaily("2026-09-16" as LocalDate, "A reflection worth keeping.");
    await new PrayerRepository(database).createPrayer({ body: "Pray for faithfulness" });
    const files = unzipSync(await createMarkdownArchive(database));
    expect(files["data.json"]).toBeDefined();
    expect(files["Reflections/2026/2026-09-16.md"]).toBeDefined();
    expect(files["Prayers/Active.md"]).toBeDefined();
  });
});
