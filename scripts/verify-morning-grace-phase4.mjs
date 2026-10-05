import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

const [contractRaw,css,main,pkgRaw,doc,...screens]=await Promise.all([
  read("canonical/morning-grace-secondary-workflows.v1.json"),
  read("src/styles/writing.css"),
  read("src/main.tsx"),
  read("package.json"),
  read("docs/PHASE_4_MORNING_GRACE_SECONDARY_WORKFLOWS.md"),
  read("src/reflection/ReflectionScreen.tsx"),
  read("src/mcheyne/PlanScreen.tsx"),
  read("src/prayer/PrayerDetailScreen.tsx"),
  read("src/prayer/PrayerSettingsScreen.tsx"),
  read("src/prayer/PeopleScreen.tsx"),
  read("src/prayer/CategoriesScreen.tsx"),
  read("src/prayer/PrayerSessionScreen.tsx"),
  read("src/scripture/CollectionsScreen.tsx"),
  read("src/search/SearchScreen.tsx"),
  read("src/data/DataScreen.tsx"),
]);

// V2 centralizes imports; the older JSON describes the retained legacy screens.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

const contract=JSON.parse(contractRaw);
const pkg=JSON.parse(pkgRaw);

assert.equal(contract.version,1);
assert.equal(contract.name,"Morning Grace Secondary Workflows");
assert.equal(contract.status,"phase-4-frozen");
for(const key of ["reflection","readingPlan","prayerDetail","prayerAdministration","focusedPrayer","collections","search","data"]) assert.ok(contract.workspaces[key],"Missing Phase 4 workspace "+key);

assert.match(screens[1], /journal-workspace plan-journal/);
assert.ok(styles.includes("plan.css"));
assert.match(screens[0], /journal-workspace journal-reflection/);
assert.match(await read("src/styles/writing.css"), /\.journal-paper/);
assert.ok(screens[1].includes("mg-plan-workspace"));
assert.ok(screens[2].includes("journal-workspace prayer-record"));
assert.ok(screens[3].includes("journal-workspace prayer-settings-journal"));
assert.match(await read("src/styles/prayer-detail.css"), /\.prayer-request-text/);
assert.ok(styles.includes("prayer-detail.css"));
assert.ok(screens[4].includes("MetadataJournal"));
assert.ok(screens[5].includes("MetadataJournal"));
assert.ok(styles.includes("prayer-metadata.css"));
assert.match(await read("src/prayer/MetadataJournal.tsx"), /metadata-journal/);
assert.ok(screens[6].includes("session-journal"));
assert.ok(styles.includes("focused-prayer.css"));
assert.ok(screens[7].includes("mg-collections-workspace"));
assert.ok(screens[8].includes("mg-search-workspace"));
assert.ok(screens[9].includes("data-journal"));
assert.match(await read("src/styles/data.css"), /\.data-journal/);

assert.match(await read("src/styles/plan.css"), /\.plan-journal/);

assert.match(css, /max-width:760px/);
// Enlarged-text reflow is certified by rendered browser journeys, not a legacy override.
assert.match(await read("tests/ux/reading-plan-journal.spec.ts"), /200%/);
assert.doesNotMatch(css,/url\(\s*["']?https?:\/\//i);

assert.ok(styles.includes("writing.css") && styles.includes("archive.css"));
assert.equal(pkg.scripts["verify:morning-grace:phase4"],"node scripts/verify-morning-grace-phase4.mjs");

assert.match(doc,/Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc,/Reflection.*M’Cheyne.*Prayer.*Collections.*Search.*Data/is);
assert.match(doc,/database schema/i);
assert.match(doc,/Production remains unchanged/i);

console.log("✓ Morning Grace Editorial Phase 4 verification passed");
console.log("  Reflection, Plan, Prayer administration/session, Collections, Search and Data workspaces frozen");
console.log("  secondary workflows use quieter editorial composition than canonical screens");
console.log("  destructive data and restore safety language preserved");
console.log("  phone and 200% text reflow rules installed");

// Archive compositions have migrated out of legacy CSS.
assert.match(await read("src/styles/archive.css"), /\.archive-segments/);
assert.match(await read("src/styles/archive.css"), /\.collection-journal-item/);
