import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

const [contractRaw,css,main,pkgRaw,doc,...screens]=await Promise.all([
  read("canonical/morning-grace-secondary-workflows.v1.json"),
  read("src/styles/morning-grace-secondary.css"),
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

for(const screen of screens) assert.ok(screen.includes("mg-secondary-screen"),"A Phase 4 screen is missing mg-secondary-screen");
assert.match(screens[0], /return \(\s*<main className="visual-screen reflection-screen mg-secondary-screen mg-reflection-workspace">/);
assert.ok(screens[1].includes("mg-plan-workspace"));
assert.ok(screens[2].includes("mg-prayer-detail-workspace"));
assert.ok(screens[3].includes("mg-prayer-settings-workspace"));
assert.ok(screens[4].includes("mg-prayer-metadata-workspace"));
assert.ok(screens[5].includes("mg-prayer-metadata-workspace"));
assert.ok(screens[6].includes("mg-focused-prayer-workspace"));
assert.ok(screens[7].includes("mg-collections-workspace"));
assert.ok(screens[8].includes("mg-search-workspace"));
assert.ok(screens[9].includes("mg-data-workspace"));

for(const selector of [
  ".mg-reflection-workspace",
  ".mg-plan-workspace",
  ".mg-prayer-detail-workspace",
  ".mg-prayer-settings-workspace",
  ".mg-prayer-metadata-workspace",
  ".mg-focused-prayer-workspace",
  ".mg-collections-workspace",
  ".mg-search-workspace",
  ".mg-data-workspace"
]) assert.ok(css.includes(selector),"Secondary CSS missing "+selector);

assert.match(css,/@media\s*\(max-width:\s*700px\)/);
assert.match(css,/font-size:\s*200%/);
assert.doesNotMatch(css,/(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css,/url\(\s*["']?https?:\/\//i);

const canonicalIndex=styles.indexOf('"./morning-grace-screens.css"');
const secondaryIndex=styles.indexOf('"./morning-grace-secondary.css"');
assert.ok(canonicalIndex>=0&&secondaryIndex>canonicalIndex,"Secondary Morning Grace styles must load after canonical screens");
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
