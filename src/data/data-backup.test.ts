import { afterEach, describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { MddDatabase, prepareDatabase } from "./database";
import { createBackupSnapshot } from "./backup";
import { PrayerRepository } from "./repositories/prayers";
import { commitMddRestore, createMarkdownArchive, discardMddRestore, generateMddBackup, inspectMddBackup, prepareMddRestore, StaleRestoreReviewError } from "./portability";
import { BACKUP_RECEIPT_KEY, readBackupReceipt, recordBackupReceipt } from "./backup-receipt";
import { parseDataContext } from "./data-context";
import type { Instant } from "../domain/types";

const databases: MddDatabase[] = [];
async function setup() { const db = new MddDatabase(`mdd-data-review-${crypto.randomUUID()}`); databases.push(db); await prepareDatabase(db); return db; }
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
const now = "2026-04-24T07:00:00.000Z" as Instant;

describe("reviewed restore", () => {
  it("bounds archive size before decompression", () => {
    expect(() => inspectMddBackup(new Uint8Array(64 * 1024 * 1024 + 1))).toThrow(/supported size/);
  });
  it("reads provisional encryption without claiming the body was validated", async () => {
    const source = await setup(), target = await setup();
    const generated = await generateMddBackup(source, "0.8.0", "a-long-password");
    expect(generated.kind).toBe("encrypted");
    expect(inspectMddBackup(generated.bytes)).toEqual({ encrypted: true });
    await expect(prepareMddRestore(generated.bytes, "wrong", "merge", target)).rejects.toThrow(/password/);
    expect(generated.generatedAt).toBe(JSON.parse(strFromU8(unzipSync(generated.bytes)["manifest.json"]!)).exportedAt);
  });
  it("computes merge effects and identifies differing equal revisions without exposing writing", async () => {
    const source = await setup(), target = await setup(), repo = new PrayerRepository(source);
    const equal = await repo.createPrayer({ body: "Incoming private body" });
    const newer = await repo.createPrayer({ body: "Newer incoming" });
    const removed = await repo.createPrayer({ body: "Removed incoming" });
    const added = await repo.createPrayer({ body: "Missing locally" });
    await source.prayers.put({ ...newer, revision: 3 });
    await source.prayers.put({ ...removed, revision: 3, deletedAt: now });
    await target.prayers.bulkPut([{ ...equal, body: "Different private local body" }, newer, removed]);
    const localOnly = await new PrayerRepository(target).createPrayer({ body: "Local only" });
    const bytes = (await generateMddBackup(source)).bytes;
    const before = (await createBackupSnapshot(target)).data;
    const review = await prepareMddRestore(bytes, "", "merge", target);
    expect(review.tables.prayers).toEqual({ additions: 1, replacements: 2, retained: 2, removals: 0, newlyRemoved: 1, restored: 0 });
    expect(review.contents.prayers).toEqual({ live: 3, deletionMarkers: 1 });
    expect(review.equalRevisionDifferences).toEqual([{ table: "prayers", key: equal.id }]);
    expect(JSON.stringify(review)).not.toMatch(/private body|private local/);
    expect((await createBackupSnapshot(target)).data).toEqual(before);
    const result = await commitMddRestore(review, target);
    expect(result.kind).toBe("committed");
    expect(await target.prayers.get(equal.id)).toMatchObject({ body: "Different private local body" });
    expect(await target.prayers.get(newer.id)).toMatchObject({ revision: 3 });
    expect(await target.prayers.get(removed.id)).toMatchObject({ deletedAt: now });
    expect(await target.prayers.get(added.id)).toBeDefined(); expect(await target.prayers.get(localOnly.id)).toBeDefined();
    const committed = (await createBackupSnapshot(target)).data;
    expect(await commitMddRestore(review, target)).toBe(result);
    expect((await createBackupSnapshot(target)).data).toEqual(committed);
  });
  it("replace reviews local-only removal and retains identical records", async () => {
    const source = await setup(), target = await setup();
    const shared = await new PrayerRepository(source).createPrayer({ body: "Shared" });
    await target.prayers.put(shared);
    await new PrayerRepository(target).createPrayer({ body: "Local only" });
    const review = await prepareMddRestore((await generateMddBackup(source)).bytes, "", "replace", target);
    expect(review.tables.prayers).toMatchObject({ retained: 1, removals: 1, replacements: 0 });
    expect(review.hasLocalDevotionalRecords).toBe(true);
    await commitMddRestore(review, target);
    expect(await target.prayers.toArray()).toEqual([shared]);
  });
  it("counts replacement reactivation of a tombstone", async () => {
    const source = await setup(), target = await setup();
    const prayer = await new PrayerRepository(source).createPrayer({ body: "Still present in older backup" });
    await target.prayers.put({ ...prayer, revision: 5, deletedAt: now });
    const review = await prepareMddRestore((await generateMddBackup(source)).bytes, "", "replace", target);
    expect(review.tables.prayers?.restored).toBe(1);
  });
  it("protects writes made any time after review, including preferences", async () => {
    const source = await setup(), target = await setup();
    const review = await prepareMddRestore((await generateMddBackup(source)).bytes, "", "replace", target);
    await target.preferences.put({ key: "theme-mode", value: "dark", updatedAt: now });
    const before = (await createBackupSnapshot(target)).data;
    await expect(commitMddRestore(review, target)).rejects.toBeInstanceOf(StaleRestoreReviewError);
    expect((await createBackupSnapshot(target)).data).toEqual(before);
  });
  it("prevents duplicate simultaneous commitment and rolls back a failed write", async () => {
    const source = await setup(), target = await setup();
    const prayer = await new PrayerRepository(source).createPrayer({ body: "Incoming" });
    await new PrayerRepository(target).createPrayer({ body: "Keep on failure" });
    const before = (await createBackupSnapshot(target)).data;
    const review = await prepareMddRestore((await generateMddBackup(source)).bytes, "", "replace", target);
    const fail = () => { throw new Error("Injected write failure"); };
    target.prayers.hook("creating", fail);
    await expect(commitMddRestore(review, target)).rejects.toThrow("Injected write failure");
    target.prayers.hook("creating").unsubscribe(fail);
    expect((await createBackupSnapshot(target)).data).toEqual(before);
    const [a, b] = await Promise.all([commitMddRestore(review, target), commitMddRestore(review, target)]);
    expect(a).toBe(b); expect(await target.prayers.toArray()).toEqual([prayer]);
    expect(await target.activityEvents.count()).toBe(await source.activityEvents.count());
  });
  it("discard, inspection, export and review write no live records or History", async () => {
    const db = await setup(); await new PrayerRepository(db).createPrayer({ body: "Unchanged" });
    const before = (await createBackupSnapshot(db)).data;
    const generated = await generateMddBackup(db); inspectMddBackup(generated.bytes);
    await createMarkdownArchive(db);
    const review = await prepareMddRestore(generated.bytes, "", "merge", db); discardMddRestore(review);
    await expect(commitMddRestore(review, db)).rejects.toThrow("no longer available");
    expect((await createBackupSnapshot(db)).data).toEqual(before);
  });
  it("does not require replacement safeguard for preferences alone and binds review to its database", async () => {
    const source = await setup(), target = await setup(), other = await setup();
    await target.preferences.put({ key: "theme-mode", value: "dark", updatedAt: now });
    const review = await prepareMddRestore((await generateMddBackup(source)).bytes, "", "replace", target);
    expect(review.hasLocalDevotionalRecords).toBe(false);
    await expect(commitMddRestore(review, other)).rejects.toThrow("no longer available");
  });
});

describe("device-only backup receipts and context", () => {
  it("stores only a typed receipt and tolerates unavailable storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(readBackupReceipt(storage)).toEqual({ status: "available", receipt: null });
    expect(recordBackupReceipt({ kind: "encrypted", generatedAt: now }, storage).status).toBe("available");
    expect(values.size).toBe(1); expect(JSON.parse(values.get(BACKUP_RECEIPT_KEY)!)).toEqual({ version: 1, generatedAt: now, kind: "encrypted" });
    expect(readBackupReceipt(storage).receipt?.kind).toBe("encrypted");
    expect(recordBackupReceipt({ kind: "plain", generatedAt: now }, { setItem: () => { throw new Error("Quota"); } }).status).toBe("unavailable");
    expect(readBackupReceipt({ getItem: () => { throw new Error("Denied"); } }).status).toBe("unavailable");
    values.set(BACKUP_RECEIPT_KEY, '{"version":2}'); expect(readBackupReceipt(storage).status).toBe("unavailable");
  });
  it("normalizes optional sections and rejects external or recursive returns", () => {
    expect(parseDataContext("?section=restore&return=%2Fhistory%3Fshown%3D25")).toMatchObject({ section: "restore", returnTo: "/history?shown=25" });
    expect(parseDataContext("?section=invalid&return=https://example.com&password=private")).toMatchObject({ section: null, returnTo: "/today", search: "" });
    for (const value of ["//example.com", "/data?return=/data", "/prayer\\evil", "/today\nsecret"]) expect(parseDataContext("?return=" + encodeURIComponent(value)).returnTo).toBe("/today");
  });
});
