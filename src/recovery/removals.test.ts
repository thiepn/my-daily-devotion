import { afterEach, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { createBackupSnapshot } from "../data/backup";
import { ReflectionRepository } from "../data/repositories/reflections";
import { PrayerRepository } from "../data/repositories/prayers";
import { PersonRepository, CategoryRepository } from "../data/repositories/prayer-metadata";
import { CollectionRepository } from "../data/repositories/collections";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import { ScriptureRepository } from "../scripture/repository";
import { newJournalState } from "./journal";
import { isRemovalContents, isRemovalPair, readRemoval, restoreRemoval } from "./removals";
import { listRemovals, removedUrl } from "./removal-presentation";

const databases:MddDatabase[]=[];
const reference={translationId:"BSB",startVerseKey:"JHN.3.16",endVerseKey:"JHN.3.18"} as const;
async function setup(){const db=new MddDatabase(`removal-${crypto.randomUUID()}`);databases.push(db);await prepareDatabase(db);return db;}
afterEach(async()=>{for(const db of databases.splice(0)){db.close();await db.delete();}});
async function snapshot(db:MddDatabase){return Promise.all(db.tables.map(async table=>[table.name,await table.toArray()]));}
async function selected(db:MddDatabase){const group=(await db.removalGroups.toArray()).sort((a,b)=>b.removedAt.localeCompare(a.removedAt))[0]!;const read=await readRemoval(db,group.id);if(read.kind!=="available")throw new Error("Expected recovery copy");return read;}

it("retains and restores exact reflection identity, original date and links without activity",async()=>{
 const db=await setup(),repo=new ReflectionRepository(db),saved=await repo.saveDaily("2024-02-29","Kept writing"),link=await repo.attachScripture(saved.reflection.id,reference);
 const events=await db.activityEvents.toArray();await repo.removeDaily("2024-02-29",saved.reflection.revision);const read=await selected(db);
 expect(read.contents.records.map(item=>item.table).sort()).toEqual(["reflections","scriptureLinks"]);
 const before=await snapshot(db);await listRemovals(db);await readRemoval(db,read.metadata.id);expect(await snapshot(db)).toEqual(before);
 expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("committed");
 expect(await repo.getDaily("2024-02-29")).toMatchObject({...saved.reflection,revision:3,updatedAt:expect.any(String)});
 expect(await db.scriptureLinks.get(link.id)).toMatchObject({revision:3,deletedAt:null});expect(await db.activityEvents.toArray()).toEqual(events);
 const after=await snapshot(db);expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("unchanged");expect(await snapshot(db)).toEqual(after);
});
it("captures only prayer children changed by the existing removal cascade",async()=>{
 const db=await setup(),repo=new PrayerRepository(db),prayer=await repo.createPrayer({body:"Original request",schedule:{mode:"DAILY"}});
 const first=await repo.addUpdate(prayer.id,"Already removed"),second=await repo.addUpdate(prayer.id,"Encouragement","encouragement");
 await db.prayerUpdates.put({...first,deletedAt:first.updatedAt,revision:2});await repo.attachScripture(prayer.id,reference);
 const answered=await repo.answer(prayer.id,"Original answer");const events=await db.activityEvents.toArray();
 await repo.removePrayer(prayer.id,answered.prayer.revision);const read=await selected(db);
 expect(read.contents.records.some(item=>item.record.id===first.id)).toBe(false);expect(read.contents.records.some(item=>item.record.id===second.id)).toBe(true);
 expect(read.contents.records.map(item=>item.table).sort()).toEqual(["prayerResolutions","prayerSchedules","prayerUpdates","prayers","scriptureLinks"]);
 expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("committed");
 expect(await db.prayers.get(prayer.id)).toMatchObject({status:"ANSWERED",deletedAt:null,createdAt:prayer.createdAt});
 expect(await db.prayerUpdates.get(first.id)).toMatchObject({deletedAt:first.updatedAt,revision:2});expect(await db.activityEvents.toArray()).toEqual(events);
});
it("covers individual metadata, verse notes, bookmarks, highlights and collection removals",async()=>{
 const db=await setup(),people=new PersonRepository(db),categories=new CategoryRepository(db),notes=new VerseNoteRepository(db),collections=new CollectionRepository(db),scripture=new ScriptureRepository(db);
 const person=await people.createPerson("Person",null,"Private notes"),category=await categories.createCategory("Category"),note=await notes.save(reference,"Verse writing"),collection=await collections.create("Journal"),item=await collections.addReference(collection.id,reference,"Note");
 await people.removePerson(person.id,person.revision);await categories.removeCategory(category.id,category.revision);await notes.remove(reference,note.revision,note.id);
 await scripture.toggleBookmark(reference);await scripture.toggleBookmark(reference);await scripture.toggleHighlight(reference);await scripture.toggleHighlight(reference);await collections.removeItem(item.id,item.revision);
 const alreadyRemoved=await db.collectionItems.get(item.id);await collections.removeCollection(collection.id,collection.revision);
 const groups=await db.removalGroups.toArray();expect(groups.map(group=>group.rootTable).sort()).toEqual(["bookmarks","categories","collectionItems","collections","highlights","people","verseNotes"]);
 const events=await db.activityEvents.toArray();
 // Restore parent before its independently removed item.
 groups.sort((a,b)=>a.rootTable==="collections"?-1:b.rootTable==="collections"?1:0);
 for(const group of groups){const read=await readRemoval(db,group.id);if(read.kind!=="available")throw Error("Missing copy");expect((await restoreRemoval(db,group.id,read.fingerprint)).kind).toBe("committed");}
 expect((await db.collectionItems.get(item.id))?.revision).toBe(alreadyRemoved!.revision+1);expect(await db.activityEvents.toArray()).toEqual(events);
});
it("collection removal restores its own live children but not previously removed children",async()=>{
 const db=await setup(),repo=new CollectionRepository(db),collection=await repo.create("Passages"),first=await repo.addReference(collection.id,reference),second=await repo.addReference(collection.id,{...reference,startVerseKey:"PSA.23.1",endVerseKey:"PSA.23.3"});
 await repo.removeItem(first.id);await repo.removeCollection(collection.id);const read=(await Promise.all((await db.removalGroups.toArray()).map(group=>readRemoval(db,group.id)))).find(row=>row.kind==="available"&&row.metadata.rootTable==="collections")!;
 if(read.kind!=="available")throw Error("Missing parent");expect(read.contents.records.map(row=>row.record.id).sort()).toEqual([collection.id,second.id].sort());expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("committed");expect((await db.collectionItems.get(first.id))?.deletedAt).not.toBeNull();
});
it("recovery storage failure rolls the domain cascade back and ordinary backups omit private copies",async()=>{
 const db=await setup(),repo=new ReflectionRepository(db),saved=await repo.saveDaily("2026-10-08","Original");await repo.attachScripture(saved.reflection.id,reference);const before=await snapshot(db);
 const fail=()=>{throw Error("Quota failure");};db.removalGroupContents.hook("creating",fail);await expect(repo.removeDaily("2026-10-08")).rejects.toThrow("Quota failure");db.removalGroupContents.hook("creating").unsubscribe(fail);expect(await snapshot(db)).toEqual(before);
 await repo.removeDaily("2026-10-08");const backup=await createBackupSnapshot(db);expect(Object.keys(backup.data)).toHaveLength(21);expect(JSON.stringify(backup)).not.toContain("removalGroupContents");
});
it("rejects stale revisions, same-revision changed content and tampered recovery pairs without writes",async()=>{
 const db=await setup(),repo=new ReflectionRepository(db),saved=await repo.saveDaily("2026-10-08","Original");await repo.removeDaily("2026-10-08");const read=await selected(db),tombstone=(await db.reflections.get(saved.reflection.id))!;
 for(const changed of [{...tombstone,revision:tombstone.revision+1},{...tombstone,bodyMd:"Different imported writing"}]){await db.reflections.put(changed);const before=await snapshot(db);expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("conflict");expect(await snapshot(db)).toEqual(before);}
 expect(isRemovalPair(read.metadata,{...read.contents,records:[]})).toBe(false);expect(isRemovalContents({...read.contents,records:[{...read.contents.records[0],record:{...saved.reflection,password:"Never accepted"}}]})).toBe(false);
 await db.reflections.put(tombstone);await db.removalGroups.put({...read.metadata,state:"expired"});const before=await snapshot(db);expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("conflict");expect(await snapshot(db)).toEqual(before);
});
it("honors the original exact thirty-day boundary, clock safety, and previous-journal isolation",async()=>{
 const db=await setup(),repo=new ReflectionRepository(db);await repo.saveDaily("2024-02-29","Original");await repo.removeDaily("2024-02-29");const read=await selected(db),before=await snapshot(db);
 expect(Date.parse(read.metadata.expiresAt)-Date.parse(read.metadata.removedAt)).toBe(30*86400000);
 expect((await restoreRemoval(db,read.metadata.id,read.fingerprint,read.metadata.expiresAt)).kind).toBe("expired");expect((await restoreRemoval(db,read.metadata.id,read.fingerprint,"bad")).kind).toBe("unavailable");expect((await restoreRemoval(db,read.metadata.id,read.fingerprint,new Date(Date.parse(read.metadata.removedAt)-1).toISOString())).kind).toBe("unavailable");expect(await snapshot(db)).toEqual(before);
 await db.draftJournalState.put(newJournalState());const replaced=await snapshot(db);expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("unavailable");expect(await snapshot(db)).toEqual(replaced);
});
it("rejects occupied dates and case-insensitive category collisions transactionally",async()=>{
 const db=await setup(),repo=new ReflectionRepository(db);await repo.saveDaily("2026-10-08","Original");await repo.removeDaily("2026-10-08");const read=await selected(db);await repo.saveDaily("2026-10-08","New journal writing");let before=await snapshot(db);expect((await restoreRemoval(db,read.metadata.id,read.fingerprint)).kind).toBe("conflict");expect(await snapshot(db)).toEqual(before);
 const categories=new CategoryRepository(db),category=await categories.createCategory("Family");await categories.removeCategory(category.id);const removed=await selected(db);await categories.createCategory("family");before=await snapshot(db);expect((await restoreRemoval(db,removed.metadata.id,removed.fingerprint)).kind).toBe("conflict");expect(await snapshot(db)).toEqual(before);
});
it("rejects removal-versus-assignment races across every prayer status",async()=>{
 for(const status of ["ACTIVE","WAITING","ANSWERED","ARCHIVED"] as const){const db=await setup(),people=new PersonRepository(db),person=await people.createPerson("Person"),prayers=new PrayerRepository(db),prayer=await prayers.createPrayer({body:"Request",personId:person.id});await db.prayers.put({...prayer,status});const before=await snapshot(db);await expect(people.removePerson(person.id)).rejects.toThrow("used by saved prayers");expect(await snapshot(db)).toEqual(before);}
});
it("normalizes external return destinations",()=>{expect(removedUrl(null,"https://outside.invalid")).toContain("return=%2Fdata");});
