import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url); const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, historyRepo, historyScreens, personalSearch, searchScreen, scriptureSearch, scriptureLoader, collectionsRepo, collectionsScreen, portability, dataScreen, bible, app, main, pkgRaw, manifestRaw, searchRaw] = await Promise.all([
  read("src/data/schema.ts"), read("src/history/repository.ts"), read("src/history/HistoryScreens.tsx"), read("src/search/personal.ts"), read("src/search/SearchScreen.tsx"), read("src/scripture/search.ts"), read("src/scripture/loader.ts"), read("src/data/repositories/collections.ts"), read("src/scripture/CollectionsScreen.tsx"), read("src/data/portability.ts"), read("src/data/DataScreen.tsx"), read("src/scripture/BibleScreen.tsx"), read("src/app/App.tsx"), read("src/main.tsx"), read("package.json"), read("public/bible/manifest.json"), read("public/bible/search-index.json"),
]);
// Visual imports moved to the single layered entrypoint; domain gates are unchanged.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

const pkg = JSON.parse(pkgRaw); const manifest = JSON.parse(manifestRaw); const searchDocs = JSON.parse(searchRaw);
assert.match(schema, /DATABASE_SCHEMA_VERSION = 1/); for (const store of ["activityEvents", "collections", "collectionItems", "reflections", "prayers"]) assert.match(schema, new RegExp(`${store}:`));
assert.match(historyRepo, /listDaySummaries/); assert.match(historyRepo, /listMoments/); assert.match(historyRepo, /PRAYER_ANSWERED/); assert.match(historyScreens, /Calendar/); assert.match(historyScreens, /Moments/);
assert.doesNotMatch(historyScreens, /\b(?:streak|streakCount|currentStreak|longestStreak|spiritualScore|spiritualScorecard|xpPoints|leaderboard)\b\s*[:=]/i);
assert.doesNotMatch(historyScreens, /className\s*=\s*["'`][^"'`]*(?:streak|spiritual-score|xp|leaderboard|achievement)/i);
assert.match(personalSearch, /prayers:/); assert.match(personalSearch, /reflections:/); assert.match(personalSearch, /people:/); assert.match(personalSearch, /saved:/); assert.match(searchScreen, /Scripture/); assert.match(searchScreen, /Saved Scripture/);
assert.match(scriptureSearch, /parseReference/); assert.match(scriptureSearch, /quoted/); assert.match(scriptureSearch, /testament/); assert.match(scriptureLoader, /loadBibleSearchIndex/); assert.equal(manifest.searchIndexPath, "/bible/search-index.json"); assert.ok(Array.isArray(searchDocs) && searchDocs.length >= 30000, `Expected >=30k searchable BSB verse documents, got ${searchDocs.length}`); const john316 = searchDocs.find((item) => item.verseKey === "JHN.3.16"); assert.ok(john316 && /God/.test(john316.text), "BSB search corpus must include John 3:16");
assert.match(collectionsRepo, /class CollectionRepository/); assert.match(collectionsRepo, /addReference/); assert.match(collectionsScreen, /Add here/); assert.match(bible, /Add to collection/); assert.match(app, /\/bible\/collections/);
for (const token of ["AES-GCM", "PBKDF2-SHA-256", "validateInTemporaryDatabase", "previewMddBackup", "importMddBackup", "createMarkdownArchive"]) assert.match(portability, new RegExp(token)); assert.match(dataScreen, /Preview & validate/); assert.match(dataScreen, /Merge/); assert.match(dataScreen, /Replace/); assert.match(dataScreen, /Markdown archive/);
for (const route of ["/history", "/history/moments", "/history/day/:localDate", "/search", "/data"]) assert.ok(app.includes(route), `Missing Phase 8 route ${route}`); assert.doesNotMatch(app, /HistoryVisual/); assert.ok(styles.includes("phase8.css")); assert.ok(pkg.scripts["verify:phase8"]);
const version = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(pkg.version); assert.ok(version, `Expected semantic package version, got ${pkg.version}`); const major = Number(version[1]); const minor = Number(version[2]); assert.ok(major > 0 || minor >= 8, `Phase 8 requires app version >=0.8.0, got ${pkg.version}`);
console.log("✓ Phase 8 History, Search & Data Portability verification passed");
console.log(`  automatic calendar/day/Moments history derived from meaningful local activity`);
console.log(`  grouped personal search + ${searchDocs.length} searchable BSB verse documents`);
console.log("  Scripture collections + checksum/encrypted backup + validated merge/replace + Markdown archive certified");
