import {afterEach, describe, expect, it} from 'vitest';
import {strFromU8, unzipSync} from 'fflate';
import {MddDatabase, prepareDatabase} from './database';
import {createBackupSnapshot, restoreBackupSnapshot, sha256Hex, stableDataJson, validateBackupSnapshot} from './backup';
import {commitMddRestore, createMarkdownArchive, generateMddBackup, prepareMddRestore, StaleRestoreReviewError} from './portability';
import {PORTABLE_CONTRACT_VERSION, PORTABLE_SCHEMA_VERSION, PORTABLE_TABLE_NAMES} from './portable-tables';
import {PrayerRepository} from './repositories/prayers';
import {schemaV1} from './schema';

const databases: MddDatabase[] = [];
const privateNames = ['editorDrafts','editorDraftContents','draftJournalState','syncOutbox'] as const;
async function setup(extended = false) {
  const db = new MddDatabase(`mdd-portable-boundary-${crypto.randomUUID()}`);
  // A test-only future database: production still registers only schema v1.
  if (extended) db.version(2).stores({editorDrafts:'&id',editorDraftContents:'&id',draftJournalState:'&key',syncOutbox:'&id'});
  databases.push(db); await prepareDatabase(db);
  if (extended) {
    for (const name of privateNames) await db.table(name).put(name==='draftJournalState'
      ? {key:'journal',epoch:'private-epoch'} : {id:'private',body:'UNSAVED PRIVATE WRITING',secret:'NOT PORTABLE'});
    const metadata = (await db.schemaMetadata.get('database'))!;
    await db.schemaMetadata.put({...metadata,schemaVersion:2});
  }
  return db;
}
async function privateRows(db: MddDatabase) {
  return Object.fromEntries(await Promise.all(privateNames.map(async name=>[name,await db.table(name).toArray()])));
}
afterEach(async()=>{for(const db of databases.splice(0)){db.close();await db.delete();}});

describe('explicit portable data boundary',()=>{
  it('keeps the complete v1 domain contract without discovering private stores',async()=>{
    expect(PORTABLE_TABLE_NAMES).toHaveLength(21);
    expect(new Set(PORTABLE_TABLE_NAMES).size).toBe(21);
    expect([...PORTABLE_TABLE_NAMES].sort()).toEqual(Object.keys(schemaV1).filter(name=>name!=='schemaMetadata').sort());
    const db=await setup(true);await new PrayerRepository(db).createPrayer({body:'Saved request'});
    const before=await privateRows(db),snapshot=await createBackupSnapshot(db);
    expect(Object.keys(snapshot.data).sort()).toEqual([...PORTABLE_TABLE_NAMES].sort());
    expect(snapshot.manifest).toMatchObject({schemaVersion:PORTABLE_SCHEMA_VERSION,contractVersion:PORTABLE_CONTRACT_VERSION,formatVersion:1});
    expect(JSON.stringify(snapshot)).not.toMatch(/UNSAVED PRIVATE|NOT PORTABLE|private-epoch|editorDrafts|syncOutbox/);
    expect(await privateRows(db)).toEqual(before);
    expect((await db.schemaMetadata.get('database'))!.schemaVersion).toBe(2);
  });

  it('plain, encrypted and Markdown exports omit private content and restore into an ordinary v1 installation',async()=>{
    const source=await setup(true),target=await setup();
    const prayer=await new PrayerRepository(source).createPrayer({body:'Portable saved wording'});
    const before=(await createBackupSnapshot(source)).data,internal=await privateRows(source);
    for(const password of ['', 'existing-password-rule']){
      const generated=await generateMddBackup(source,'1.3.0',password),files=unzipSync(generated.bytes);
      const manifest=JSON.parse(strFromU8(files['manifest.json']!));
      expect(manifest.schemaVersion).toBe(1);expect(manifest.formatVersion).toBe(1);
      if(!password)expect(JSON.parse(strFromU8(files['data.json']!))).toEqual(before);
      const review=await prepareMddRestore(generated.bytes,password,'replace',target);
      expect(Object.keys(review.contents).sort()).toEqual([...PORTABLE_TABLE_NAMES].sort());
      await commitMddRestore(review,target);
      expect(await target.prayers.get(prayer.id)).toEqual(prayer);
    }
    const markdown=unzipSync(await createMarkdownArchive(source));
    expect(JSON.parse(strFromU8(markdown['data.json']!))).toEqual(before);
    expect(Object.values(markdown).map(bytes=>strFromU8(bytes)).join('\n')).not.toMatch(/UNSAVED PRIVATE|NOT PORTABLE|private-epoch/);
    expect((await createBackupSnapshot(source)).data).toEqual(before);expect(await privateRows(source)).toEqual(internal);
  });

  it('legacy snapshot replacement changes only portable stores, retaining private rows and schema metadata',async()=>{
    const source=await setup(),target=await setup(true);
    const incoming=await new PrayerRepository(source).createPrayer({body:'Incoming legacy saved record'});
    const local=await new PrayerRepository(target).createPrayer({body:'Local-only saved record'});
    const internal=await privateRows(target),metadata=await target.schemaMetadata.toArray();
    const snapshot=await createBackupSnapshot(source,'0.8.0');
    await validateBackupSnapshot(snapshot,target);await restoreBackupSnapshot(snapshot,target);
    expect(await target.prayers.get(incoming.id)).toEqual(incoming);expect(await target.prayers.get(local.id)).toBeUndefined();
    expect(await privateRows(target)).toEqual(internal);expect(await target.schemaMetadata.toArray()).toEqual(metadata);
  });

  it.each(['merge','replace'] as const)('%s review ignores private-store changes and commits without clearing them',async mode=>{
    const source=await setup(),target=await setup(true);
    const incoming=await new PrayerRepository(source).createPrayer({body:'Incoming saved record'});
    const local=await new PrayerRepository(target).createPrayer({body:'Keep only when merging'});
    const review=await prepareMddRestore((await generateMddBackup(source)).bytes,'',mode,target);
    expect(Object.keys(review.tables).sort()).toEqual([...PORTABLE_TABLE_NAMES].sort());
    await target.table('editorDraftContents').put({id:'newer-draft',body:'NEWER UNSAVED WRITING'});
    await target.table('syncOutbox').put({id:'private-change',secret:'PRIVATE'});
    const internal=await privateRows(target),metadata=await target.schemaMetadata.toArray();
    const result=await commitMddRestore(review,target);
    expect(result.kind).toBe('committed');expect(await target.prayers.get(incoming.id)).toEqual(incoming);
    expect(Boolean(await target.prayers.get(local.id))).toBe(mode==='merge');
    expect(await privateRows(target)).toEqual(internal);expect(await target.schemaMetadata.toArray()).toEqual(metadata);
    expect(await commitMddRestore(review,target)).toBe(result);
  });

  it('still rejects a domain change after review and rolls back without touching private stores',async()=>{
    const source=await setup(),target=await setup(true);
    const review=await prepareMddRestore((await generateMddBackup(source)).bytes,'','replace',target);
    await new PrayerRepository(target).createPrayer({body:'Changed after review'});
    const domain=(await createBackupSnapshot(target)).data,internal=await privateRows(target);
    await expect(commitMddRestore(review,target)).rejects.toBeInstanceOf(StaleRestoreReviewError);
    expect((await createBackupSnapshot(target)).data).toEqual(domain);expect(await privateRows(target)).toEqual(internal);
  });

  it('failed replacement rolls back portable writes and leaves internal stores intact',async()=>{
    const source=await setup(),target=await setup(true);
    await new PrayerRepository(source).createPrayer({body:'Incoming'});
    await new PrayerRepository(target).createPrayer({body:'Keep on failure'});
    const review=await prepareMddRestore((await generateMddBackup(source)).bytes,'','replace',target);
    const domain=(await createBackupSnapshot(target)).data,internal=await privateRows(target);
    const fail=()=>{throw new Error('Injected portable write failure');};target.prayers.hook('creating',fail);
    await expect(commitMddRestore(review,target)).rejects.toThrow('Injected portable write failure');
    target.prayers.hook('creating').unsubscribe(fail);
    expect((await createBackupSnapshot(target)).data).toEqual(domain);expect(await privateRows(target)).toEqual(internal);
  });

  it('rejects unknown private tables and missing domain tables even with a valid checksum',async()=>{
    const source=await setup(),target=await setup(true);
    const snapshot=await createBackupSnapshot(source),before=await privateRows(target);
    snapshot.data.editorDraftContents=[{id:'leak',body:'UNSAVED'}];
    snapshot.manifest.checksums.dataSha256=await sha256Hex(stableDataJson(snapshot.data));
    await expect(restoreBackupSnapshot(snapshot,target)).rejects.toThrow('unknown table: editorDraftContents');
    delete snapshot.data.editorDraftContents;delete snapshot.data.prayers;
    snapshot.manifest.checksums.dataSha256=await sha256Hex(stableDataJson(snapshot.data));
    await expect(restoreBackupSnapshot(snapshot,target)).rejects.toThrow('missing required table: prayers');
    expect(await privateRows(target)).toEqual(before);
  });
});
