import { afterEach, describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { MddDatabase, prepareDatabase } from "./database";
import { createBackupSnapshot } from "./backup";
import { checkMddBackup, commitMddRestore, generateMddBackup, prepareMddRestore, StaleRestoreReviewError } from "./portability";
import { readJournalEpoch } from "../recovery/journal";
import { validateRecoveryPayload } from "./recovery-archive";
import { ReflectionRepository } from "./repositories/reflections";
import type { DraftContents, DraftMetadata } from "../recovery/types";
import type { SavedVersionMetadata, SavedVersionContents, RemovalGroupMetadata, RemovalGroupContents } from "../recovery/saved-types";

const databases: MddDatabase[] = [];
async function db() { const instance = new MddDatabase("mdd-p5-" + crypto.randomUUID()); databases.push(instance); await prepareDatabase(instance); return instance; }
afterEach(async () => { for (const instance of databases.splice(0)) { instance.close(); await instance.delete(); } });
const now = "2026-10-09T10:00:00.000Z";

async function addPrivateWriting(database: MddDatabase) {
  const epoch = await readJournalEpoch(database);
  const reflection = await new ReflectionRepository(database).saveDaily("2026-09-16", "Previously saved reflection");
  const id = crypto.randomUUID();
  const metadata: DraftMetadata = {
    id, formatVersion: 1, kind: "reflection", targetKey: "reflection:2026-09-16",
    journalEpoch: epoch, createdAt: now, updatedAt: now, generation: 1, state: "active",
    context: { returnTo: "/today", reading: null }, lineage: null, commitment: null,
  };
  const contents: DraftContents = {
    id, generation: 1, payload: { kind: "reflection", localDate: "2026-09-16",
      bodyMd: "SECRET_UNFINISHED_JOURNAL", baseline: null, pendingReferences: [], dismissedReferences: false },
  };
  const versionId = crypto.randomUUID();
  const version: SavedVersionMetadata = {
    id: versionId, formatVersion: 1, journalEpoch: epoch, kind: "reflection",
    targetKey: "reflection:" + reflection.reflection.id, targetId: reflection.reflection.id,
    originalRevision: 1, capturedAt: now, writingDate: "2026-09-16",
  };
  const versionBody: SavedVersionContents = { id: versionId, formatVersion: 1,
    writing: { kind: "reflection", bodyMd: "SECRET_OLD_WRITING", localDate: "2026-09-16" } };
  const removalId = crypto.randomUUID();
  const removedAt = "2026-09-16T00:00:00.000Z";
  const group: RemovalGroupMetadata = {
    id: removalId, formatVersion: 1, journalEpoch: epoch, removedAt,
    expiresAt: new Date(Date.parse(removedAt) + 30 * 86400000).toISOString(), state: "available",
    rootTable: "reflections", rootId: reflection.reflection.id,
    affected: [{ table: "reflections", id: reflection.reflection.id, beforeRevision: reflection.reflection.revision,
      afterRevision: reflection.reflection.revision + 1 }],
  };
  const groupContents: RemovalGroupContents = { id: removalId, formatVersion: 1,
    records: [{ table: "reflections", record: reflection.reflection }] };
  await database.transaction("rw", [database.editorDrafts, database.editorDraftContents,
    database.savedVersions, database.savedVersionContents, database.removalGroups, database.removalGroupContents], async () => {
    await database.editorDrafts.add(metadata); await database.editorDraftContents.add(contents);
    await database.savedVersions.add(version); await database.savedVersionContents.add(versionBody);
    await database.removalGroups.add(group); await database.removalGroupContents.add(groupContents);
  });
  return { id, versionId, removalId, epoch, metadata };
}
const snapshot = (database: MddDatabase) => Promise.all(database.tables.map(table => table.toArray()));

describe("P5 explicitly encrypted format-2 recovery portability", () => {
  it("keeps ordinary v1 archives unchanged, private drafts and recovery contents excluded", async () => {
    const source = await db(); await addPrivateWriting(source);
    const original = await generateMddBackup(source, "1.3.0");
    const files = unzipSync(original.bytes);
    const manifest = JSON.parse(strFromU8(files["manifest.json"]!));
    expect(manifest.formatVersion).toBe(1);
    expect(manifest).not.toHaveProperty("recovery");
    expect(strFromU8(files["data.json"]!)).not.toContain("SECRET_");
    expect(JSON.parse(strFromU8(files["data.json"]!))).not.toHaveProperty("editorDrafts");
    expect((await checkMddBackup(original.bytes, "", source)).recovery).toBeUndefined();
    const encrypted = await generateMddBackup(source, "1.3.0", "strong-passphrase");
    expect((await checkMddBackup(encrypted.bytes, "strong-passphrase", source)).manifest.formatVersion).toBe(1);
  });

  it("requires opt-in and encryption, validates counts and imports old writing as inert previous-journal copies", async () => {
    const source = await db(), destination = await db();
    const originals = await addPrivateWriting(source);
    await expect(generateMddBackup(source, "1.3.0", undefined, true)).rejects.toThrow(/password/i);
    const exported = await generateMddBackup(source, "1.3.0", "strong-passphrase", true);
    expect(strFromU8(exported.bytes)).not.toContain("SECRET_UNFINISHED_JOURNAL");
    expect(strFromU8(exported.bytes)).not.toContain("SECRET_OLD_WRITING");
    const files = unzipSync(exported.bytes), manifest = JSON.parse(strFromU8(files["manifest.json"]!));
    expect(manifest).toMatchObject({ formatVersion: 2, schemaVersion: 1, recovery: { payloadVersion: 1 } });
    const before = await snapshot(destination);
    const checked = await checkMddBackup(exported.bytes, "strong-passphrase", destination);
    expect(checked.recovery).toEqual({ activeDrafts: 1, copyOnlyDrafts: 0, priorVersions: 1, eligibleRemovals: 1, expiredRemovals: 0 });
    expect(JSON.stringify(checked)).not.toContain("SECRET_");
    expect(await snapshot(destination)).toEqual(before);
    const review = await prepareMddRestore(exported.bytes, "strong-passphrase", "replace", destination);
    expect(review.recovery).toEqual(checked.recovery);
    expect((await commitMddRestore(review, destination)).kind).toBe("committed");
    expect((await destination.editorDraftContents.get(originals.id))?.payload).toMatchObject({ bodyMd: "SECRET_UNFINISHED_JOURNAL" });
    const imported = await destination.editorDrafts.get(originals.id);
    expect(imported?.journalEpoch).not.toEqual(await readJournalEpoch(destination));
    const version = await destination.savedVersions.get(originals.versionId);
    const removal = await destination.removalGroups.get(originals.removalId);
    expect(version?.journalEpoch).not.toEqual(await readJournalEpoch(destination));
    expect(removal?.journalEpoch).not.toEqual(await readJournalEpoch(destination));
    expect(await destination.savedVersionContents.get(originals.versionId)).toMatchObject({ writing: { bodyMd: "SECRET_OLD_WRITING" } });
  });

  it("deduplicates the same source recovery on a second import and never erases current private entries", async () => {
    const source = await db(), dest = await db();
    const old = await addPrivateWriting(source);
    const encrypted = await generateMddBackup(source, "1.3.0", "strong-passphrase", true);
    for (let pass = 0; pass < 2; pass++) {
      const review = await prepareMddRestore(encrypted.bytes, "strong-passphrase", "merge", dest);
      await commitMddRestore(review, dest);
    }
    expect(await dest.editorDrafts.count()).toBe(1);
    expect(await dest.savedVersions.count()).toBe(1);
    expect(await dest.removalGroups.count()).toBe(1);
    const entry = await dest.editorDrafts.get(old.id);
    expect(entry?.journalEpoch).not.toEqual(await readJournalEpoch(dest));
    const other = await addPrivateWriting(dest);
    const replacedReview = await prepareMddRestore(encrypted.bytes, "strong-passphrase", "replace", dest);
    await commitMddRestore(replacedReview, dest);
    expect(await dest.editorDraftContents.get(other.id)).toBeDefined();
  });

  it("rejects incorrect password and a forged or future recovery header without changing the target", async () => {
    const source = await db(), target = await db();
    await addPrivateWriting(source);
    const original = await generateMddBackup(source, "1.3.0", "strong-passphrase", true);
    const before = await snapshot(target);
    await expect(checkMddBackup(original.bytes, "wrong-pass", target)).rejects.toThrow(/password|damaged/i);
    const files = unzipSync(original.bytes), manifest = JSON.parse(strFromU8(files["manifest.json"]!));
    manifest.recovery.payloadVersion = 99;
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(prepareMddRestore(zipSync(files), "strong-passphrase", "merge", target)).rejects.toThrow(/recovery/i);
    manifest.recovery.payloadVersion = 1;
    manifest.encryption = null;
    files["manifest.json"] = strToU8(JSON.stringify(manifest));
    await expect(checkMddBackup(zipSync(files), "strong-passphrase", target)).rejects.toThrow(/encryption/i);
    expect(await snapshot(target)).toEqual(before);
  });

  it("invalid recovery metadata is rejected even with correctly typed top-level payload", async () => {
    const source = await db();
    const privateRows = await addPrivateWriting(source);
    const payload = {
      version: 1, sourceEpoch: privateRows.epoch,
      stores: {
        editorDrafts: [{ ...privateRows.metadata, journalEpoch: "not-a-uuid" }],
        editorDraftContents: [{ id: privateRows.id, generation: 1, payload: { kind: "reflection", localDate: "2026-09-16", bodyMd: "SECRET", baseline: null, pendingReferences: [], dismissedReferences: false } }],
        savedVersions: [], savedVersionContents: [], removalGroups: [], removalGroupContents: [],
      },
    };
    expect(() => validateRecoveryPayload(payload)).toThrow(/invalid private metadata/i);
    const missing = { ...payload, stores: { ...payload.stores, editorDraftContents: [] } };
    expect(() => validateRecoveryPayload(missing)).toThrow();
  });

  it("an intervening private write invalidates a reviewed v2 restore without mutating the domain", async () => {
    const source = await db(), dest = await db();
    await addPrivateWriting(source);
    const archive = await generateMddBackup(source, "1.3.0", "strong-passphrase", true);
    const review = await prepareMddRestore(archive.bytes, "strong-passphrase", "merge", dest);
    const before = await createBackupSnapshot(dest);
    const old = await readJournalEpoch(dest);
    const sourceDraft = (await source.editorDrafts.toArray())[0]!;
    const sourceContents = (await source.editorDraftContents.toArray())[0]!;
    const id = crypto.randomUUID();
    await dest.transaction("rw", [dest.editorDrafts, dest.editorDraftContents], async () => {
      await dest.editorDrafts.add({ ...sourceDraft, id, journalEpoch: old });
      await dest.editorDraftContents.add({ ...sourceContents, id });
    });
    await expect(commitMddRestore(review, dest)).rejects.toBeInstanceOf(StaleRestoreReviewError);
    expect(await readJournalEpoch(dest)).toBe(old);
    expect((await createBackupSnapshot(dest)).data).toEqual(before.data); // Only the private draft changed.
    expect(await dest.editorDrafts.count()).toBe(1);
  });
});
