import { afterEach, describe, expect, it } from "vitest";
import { APP_VERSION } from "../app/version";
import { nowInstant } from "../domain/identity";
import { createMddBackup, importMddBackup } from "./portability";
import { MddDatabase, prepareDatabase } from "./database";
import { auditDatabase } from "./integrity";
import { PrayerRepository } from "./repositories/prayers";

const databases: MddDatabase[] = [];
function database(name = `mdd-resilience-${crypto.randomUUID()}`): MddDatabase { const value = new MddDatabase(name); databases.push(value); return value; }

afterEach(async () => {
  for (const value of databases.splice(0)) {
    value.close();
    await value.delete().catch(() => undefined);
  }
});

describe("Phase 10 local resilience", () => {
  it("restores a validated backup after the original IndexedDB database is deleted", async () => {
    const name = `mdd-loss-${crypto.randomUUID()}`;
    const original = database(name);
    await prepareDatabase(original);
    const prayers = new PrayerRepository(original);
    const prayer = await prayers.createPrayer({ body: "Preserve this prayer across device-storage loss." });
    await prayers.addUpdate(prayer.id, "A meaningful update", "update");
    await prayers.answer(prayer.id, "Answer remembered after restore.");
    await original.preferences.put({ key: "theme-mode", value: "dark", updatedAt: nowInstant() });

    const backup = await createMddBackup(original, APP_VERSION, "strong-passphrase");
    original.close();
    await original.delete();

    const restored = database(name);
    await prepareDatabase(restored);
    await importMddBackup(backup, "strong-passphrase", "replace", restored);

    expect(await restored.prayers.get(prayer.id)).toMatchObject({ status: "ANSWERED", body: prayer.body });
    expect((await restored.prayerUpdates.where("prayerId").equals(prayer.id).toArray()).map((item) => item.body)).toContain("A meaningful update");
    expect((await restored.prayerResolutions.where("prayerId").equals(prayer.id).first())?.reflectionMd).toBe("Answer remembered after restore.");
    expect((await restored.preferences.get("theme-mode"))?.value).toBe("dark");
    expect((await auditDatabase(restored)).ok).toBe(true);
  });

  it("refuses a newer schema without clearing existing records", async () => {
    const value = database();
    await prepareDatabase(value);
    const prayer = await new PrayerRepository(value).createPrayer({ body: "Do not clear me on an incompatible upgrade." });
    const metadata = await value.schemaMetadata.get("database");
    expect(metadata).toBeDefined();
    await value.schemaMetadata.put({ ...metadata!, schemaVersion: 999, updatedAt: nowInstant() });
    value.close();

    await expect(prepareDatabase(value)).rejects.toThrow(/newer than this app supports/i);
    expect((await value.prayers.get(prayer.id))?.body).toBe(prayer.body);
  });
});
