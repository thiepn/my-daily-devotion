import {afterEach,describe,expect,it} from "vitest";
import {MddDatabase,prepareDatabase} from "../data/database";
import {PrayerRepository} from "../data/repositories/prayers";
import {parsePrayerDetailQuery,prayerTimeline,readPrayerDetail,readPrayerMetadata,safePrayerReturn} from "./detail-model";
const databases:MddDatabase[]=[];
function setup(){const db=new MddDatabase("detail-"+crypto.randomUUID());databases.push(db);return db;}
afterEach(async()=>{for(const db of databases.splice(0)){db.close();await db.delete();}});
describe("Prayer detail read models and guarded lifecycle",()=>{
 it("reads without seeding metadata or writing events and orders the story newest first",async()=>{
  const db=setup();await prepareDatabase(db);const repo=new PrayerRepository(db);
  const prayer=await repo.createPrayer({body:"Keep this request."});
  await repo.addUpdate(prayer.id,"First","update","2026-04-20T06:00:00.000Z");
  await repo.addUpdate(prayer.id,"Second","encouragement","2026-04-21T06:00:00.000Z");
  await repo.answer(prayer.id,"An answer","2026-04-22T06:00:00.000Z");
  const before=await Promise.all(db.tables.map(t=>t.toArray()));
  const model=await readPrayerDetail(db,prayer.id);
  expect(prayerTimeline(model!).map(row=>row.kind)).toEqual(["answer","encouragement","update"]);
  expect((await readPrayerMetadata(db)).categories).toEqual([]);
  expect(await Promise.all(db.tables.map(t=>t.toArray()))).toEqual(before);
 });
 it("checks parent and child tombstones before exposing writing",async()=>{
  const db=setup();await prepareDatabase(db);const repo=new PrayerRepository(db);const prayer=await repo.createPrayer({body:"Request"});
  const update=await repo.addUpdate(prayer.id,"Hidden");await db.prayerUpdates.update(update.id,{deletedAt:"2026-04-22T06:00:00.000Z"});
  expect((await readPrayerDetail(db,prayer.id))?.updates).toEqual([]);
  await repo.removePrayer(prayer.id);expect(await readPrayerDetail(db,prayer.id)).toBeNull();
 });
 it("rejects stale lifecycle changes without events or record changes",async()=>{
  const db=setup();await prepareDatabase(db);const repo=new PrayerRepository(db);const prayer=await repo.createPrayer({body:"Request"});
  await repo.updateBody(prayer.id,"New wording",prayer.revision);
  const before=await Promise.all(db.tables.map(t=>t.toArray()));
  await expect(repo.transition(prayer.id,"WAITING",prayer.revision)).rejects.toThrow(/another tab/);
  await expect(repo.answer(prayer.id,"Answer",undefined,prayer.revision)).rejects.toThrow(/another tab/);
  await expect(repo.removePrayer(prayer.id,prayer.revision)).rejects.toThrow(/another tab/);
  expect(await Promise.all(db.tables.map(t=>t.toArray()))).toEqual(before);
  const current=await repo.get(prayer.id);await repo.transition(prayer.id,"ARCHIVED",current!.revision);
  await expect(repo.restoreArchived(prayer.id,current!.revision)).rejects.toThrow(/another tab/);
 });
 it("normalizes optional query state while retaining complete internal return URLs",()=>{
  const back="/history/day/2026-04-24?entry=event&return=%2Fhistory%3Fshown%3D25";
  const query=parsePrayerDetailQuery("?shown=41&entry=update:abc&return="+encodeURIComponent(back));
  expect(query.shown).toBe(60);expect(query.entry).toBe("update:abc");expect(query.returnTo).toBe(back);
  expect(parsePrayerDetailQuery("?shown=-4&entry=bad&return=https://example.com").search).toBe("");
  expect(safePrayerReturn("//example.com")).toBe("/prayer");
 });
});

