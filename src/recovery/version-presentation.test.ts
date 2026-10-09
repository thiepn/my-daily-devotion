import { afterEach, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import { SavedVersionRepository } from "./saved-versions";
import { parseVersionContext, readVersionComparison, savedVersionsUrl, validVersionTarget, versionFields } from "./version-presentation";
import { restoreSavedVersion } from "./restore-version";
const databases: MddDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function fixture() {
  const db = new MddDatabase(`version-review-${crypto.randomUUID()}`); databases.push(db); await prepareDatabase(db);
  const repo = new ReflectionRepository(db), first = await repo.saveDaily("2024-02-29", "Original\n\nWriting");
  const current = await repo.saveDaily("2024-02-29", "Current writing", first.reflection.revision);
  const id = (await new SavedVersionRepository(db).list()).rows[0]!.id;
  return { db, repo, current: current.reflection, id };
}
const snapshot = (db: MddDatabase) => Promise.all(db.tables.map(async table => [table.name, await table.toArray()]));
it("validates version query context and preserves the complete editor return", () => {
  const target = `reflection:${crypto.randomUUID()}`, origin = "/today/reflection/2024-02-29?return=%2Fhistory%3Fshown%3D40";
  expect(validVersionTarget(target)).toBe(target); expect(validVersionTarget("constructor:anything")).toBeNull();
  expect(parseVersionContext(new URL(savedVersionsUrl(null, origin, 40, target), "https://local.invalid").search)).toEqual({ returnTo: origin, shown: 40, target });
  expect(parseVersionContext("?return=https://outside.invalid&shown=-1&target=bad")).toEqual({returnTo:"/data",shown:20,target:null});
});
it("comparison and copy fields are readonly and show preserved paragraphs", async () => {
  const { db, id } = await fixture(), before = await snapshot(db), review = await readVersionComparison(db,id);
  expect(review.kind).toBe("available"); if (review.kind !== "available") throw new Error("Missing fixture");
  expect(review.currentWriting).toMatchObject({bodyMd:"Current writing"}); expect(review.reason).toBe("");
  expect(versionFields(review.contents.writing)).toEqual([{label:"Writing",text:"Original\n\nWriting"}]);
  expect(await snapshot(db)).toEqual(before);
});
it("confirmation rejects changed version contents without writing any record", async () => {
  const { db, id, current } = await fixture(), review = await readVersionComparison(db,id);
  if (review.kind !== "available") throw new Error("Missing fixture");
  const contents = await db.savedVersionContents.get(id); await db.savedVersionContents.put({...contents!,writing:{kind:"reflection",localDate:"2024-02-29",bodyMd:"Changed underneath review"}});
  const before = await snapshot(db); expect(await restoreSavedVersion(db,id,current.revision,review.fingerprint)).toMatchObject({kind:"review-changed"}); expect(await snapshot(db)).toEqual(before);
});
it("confirmation rejects a concurrently edited entry and restoration adds no activity", async () => {
  const { db, id, current, repo } = await fixture(), review = await readVersionComparison(db,id);
  if (review.kind !== "available") throw new Error("Missing fixture");
  const edited = await repo.saveDaily("2024-02-29","Another tab",current.revision), before = await snapshot(db);
  expect(await restoreSavedVersion(db,id,current.revision,review.fingerprint)).toMatchObject({kind:"conflict"}); expect(await snapshot(db)).toEqual(before);
  const count = await db.activityEvents.count(); expect(await restoreSavedVersion(db,id,edited.reflection.revision,review.fingerprint)).toMatchObject({kind:"committed"});
  expect(await db.activityEvents.count()).toBe(count); expect(await db.reflections.get(current.id)).toMatchObject({bodyMd:"Original\n\nWriting",localDate:"2024-02-29",revision:4});
});
it("removed originals remain copyable and cannot be silently recreated", async () => {
  const { db, id, current } = await fixture(); await db.reflections.update(current.id,{deletedAt:"2026-10-08T12:00:00.000Z"});
  const before = await snapshot(db), review = await readVersionComparison(db,id);
  expect(review).toMatchObject({kind:"available",current:null,reason:expect.stringContaining("removed")});
  expect(await restoreSavedVersion(db,id,current.revision)).toMatchObject({kind:"unavailable"}); expect(await snapshot(db)).toEqual(before);
});
