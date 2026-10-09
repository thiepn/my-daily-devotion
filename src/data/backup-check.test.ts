import { afterEach, expect, it } from 'vitest';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { MddDatabase, prepareDatabase } from './database';
import { checkMddBackup, generateMddBackup } from './portability';
import { PrayerRepository } from './repositories/prayers';
const databases: MddDatabase[] = [];
afterEach(async () => { for (const db of databases.splice(0)) { db.close(); await db.delete(); } });
async function setup() { const db = new MddDatabase(`backup-check-${crypto.randomUUID()}`); databases.push(db); await prepareDatabase(db); return db; }
async function snapshot(db: MddDatabase) { return Promise.all(db.tables.map(table => table.toArray())); }
it('checks plain and encrypted historical-v1 contents without exposing writing or creating a restore capability', async () => {
  const source = await setup(), local = await setup();
  await new PrayerRepository(local).createPrayer({ body: 'Local writing must stay unchanged.' });
  const request = await new PrayerRepository(source).createPrayer({ body: 'Private text must not appear in a summary.' });
  await source.prayers.put({ ...request, deletedAt: '2026-04-24T05:00:00.000Z', revision: 2 });
  const before = await snapshot(local);
  for (const password of ['', 'a-long-password']) {
    const archive = await generateMddBackup(source, '0.8.0', password || undefined);
    const checked = await checkMddBackup(archive.bytes, password, local);
    expect(checked.contents.prayers).toEqual({ live: 0, deletionMarkers: 1 });
    expect(checked.encrypted).toBe(Boolean(password));
    expect(checked.manifest.schemaVersion).toBe(1);
    expect(JSON.stringify(checked)).not.toContain('Private text');
    expect(checked).not.toHaveProperty('effects');
    expect(await snapshot(local)).toEqual(before);
  }
});
it('rejects wrong passwords and corrupted bodies without writes', async () => {
  const source = await setup(), local = await setup(), before = await snapshot(local);
  const encrypted = await generateMddBackup(source, '0.8.0', 'a-long-password');
  await expect(checkMddBackup(encrypted.bytes, 'wrong', local)).rejects.toThrow(/password/);
  const files = unzipSync((await generateMddBackup(source)).bytes); files['data.json'] = strToU8('{}');
  await expect(checkMddBackup(zipSync(files), '', local)).rejects.toThrow(/checksum|size|length/i);
  expect(await snapshot(local)).toEqual(before);
});
