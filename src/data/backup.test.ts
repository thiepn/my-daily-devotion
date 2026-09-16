import { afterEach, describe, expect, it } from "vitest";
import { createBackupSnapshot, restoreBackupSnapshot, validateBackupSnapshot } from "./backup";
import { MddDatabase, prepareDatabase } from "./database";
import { PrayerRepository } from "./repositories/prayers";

const openDatabases: MddDatabase[] = [];
function testDb(): MddDatabase {
  const database = new MddDatabase(`mdd-backup-test-${crypto.randomUUID()}`);
  openDatabases.push(database);
  return database;
}

afterEach(async () => {
  for (const database of openDatabases.splice(0)) {
    database.close();
    await database.delete();
  }
});

describe("backup prototype", () => {
  it("round-trips local data through a checksum-verified snapshot", async () => {
    const source = testDb();
    const target = testDb();
    await prepareDatabase(source);
    await prepareDatabase(target);
    const created = await new PrayerRepository(source).createPrayer({ body: "Remember this request." });
    const snapshot = await createBackupSnapshot(source);
    await validateBackupSnapshot(snapshot, target);
    await restoreBackupSnapshot(snapshot, target);
    expect(await target.prayers.get(created.id)).toMatchObject({ id: created.id, body: "Remember this request.", revision: 1 });
  });

  it("rejects tampered data before modifying the target database", async () => {
    const source = testDb();
    const target = testDb();
    await prepareDatabase(source);
    await prepareDatabase(target);
    await new PrayerRepository(source).createPrayer({ body: "Original" });
    const protectedPrayer = await new PrayerRepository(target).createPrayer({ body: "Do not erase me" });
    const snapshot = await createBackupSnapshot(source);
    snapshot.data.prayers = [...(snapshot.data.prayers ?? []), { id: "tampered" }];
    await expect(restoreBackupSnapshot(snapshot, target)).rejects.toThrow("checksum");
    expect(await target.prayers.get(protectedPrayer.id)).toBeDefined();
  });
});
