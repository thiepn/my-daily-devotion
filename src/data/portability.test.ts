import { afterEach, describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
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

  it("encrypts sensitive data with a password and rejects a wrong password", async () => {
    const source = testDb(); const target = testDb(); await prepareDatabase(source); await prepareDatabase(target);
    await new PrayerRepository(source).createPrayer({ body: "Private request" });
    const bytes = await createMddBackup(source, "0.8.0", "correct-horse-battery");
    await expect(previewMddBackup(bytes, "wrong-password", target)).rejects.toThrow(/password|damaged/i);
    const preview = await previewMddBackup(bytes, "correct-horse-battery", target);
    expect(preview.encrypted).toBe(true);
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
