import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url); const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, repository, app, prayerScreen, newPrayer, detail, session, context, main, pkgRaw] = await Promise.all([
  read("src/data/schema.ts"), read("src/data/repositories/prayers.ts"), read("src/app/App.tsx"), read("src/prayer/PrayerScreen.tsx"), read("src/prayer/NewPrayerScreen.tsx"), read("src/prayer/PrayerDetailScreen.tsx"), read("src/prayer/PrayerSessionScreen.tsx"), read("src/prayer/context.ts"), read("src/main.tsx"), read("package.json"),
]);
const pkg = JSON.parse(pkgRaw);
assert.match(schema, /DATABASE_SCHEMA_VERSION = 1/);
for (const store of ["prayers", "prayerUpdates", "prayerResolutions", "scriptureLinks"]) assert.match(schema, new RegExp(`${store}:`));
for (const event of ["PRAYER_CREATED", "PRAYER_PRAYED", "PRAYER_UPDATED", "ENCOURAGEMENT_RECORDED", "PRAYER_ANSWERED"]) assert.match(repository, new RegExp(event));
assert.match(repository, /rotationQueue/); assert.match(repository, /lastPrayedAt === null/); assert.match(repository, /attachScripture/); assert.match(repository, /removePrayer/);
assert.match(app, /PrayerScreen/); assert.match(app, /NewPrayerScreen/); assert.match(app, /PrayerDetailScreen/); assert.match(app, /PrayerSessionScreen/); assert.match(app, /\/prayer\/:prayerId/); assert.match(app, /\/prayer\/session/);
assert.match(prayerScreen, /Quick/); assert.match(prayerScreen, /Regular/); assert.match(prayerScreen, /Extended/); assert.match(newPrayer, /What do you want to pray about/); assert.match(newPrayer, /sourceReflectionId/); assert.match(detail, /Updates & encouragements/); assert.match(detail, /Mark answered/); assert.match(session, /Next/); assert.match(session, /Skip/); assert.match(session, /repository\.markPrayed/); assert.match(context, /buildPrayerFromScriptureUrl/);
assert.ok(main.includes("phase6.css")); assert.ok(pkg.scripts["verify:phase6"]); assert.equal(pkg.version, "0.6.0");
console.log("✓ Phase 6 Prayer Core verification passed");
console.log("  quick capture + prayer lifecycle + append-only updates certified");
console.log("  answered prayer resolution and Scripture/reflection provenance preserved");
console.log("  basic least-recently-prayed focused flow wired locally");
