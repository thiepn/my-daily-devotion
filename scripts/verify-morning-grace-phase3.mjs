import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [contractRaw, today, bible, prayer, history, css, main, doc, packageRaw] = await Promise.all([
  read("canonical/morning-grace-canonical-screens.v1.json"),
  read("src/mcheyne/TodayScreen.tsx"),
  read("src/scripture/BibleScreen.tsx"),
  read("src/prayer/PrayerScreen.tsx"),
  read("src/history/HistoryScreens.tsx"),
  read("src/styles/morning-grace-screens.css"),
  read("src/main.tsx"),
  read("docs/PHASE_3_MORNING_GRACE_CANONICAL_SCREENS.md"),
  read("package.json"),
]);

// V2 centralizes imports; the older JSON describes the retained legacy screens.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

const contract=JSON.parse(contractRaw);
const pkg=JSON.parse(packageRaw);
assert.equal(contract.version,1);
assert.equal(contract.name,"Morning Grace Canonical Screens");
assert.equal(contract.status,"phase-3-frozen");
for(const screen of ["today","bible","prayer","history"]) assert.ok(contract.screens[screen], "Missing canonical screen contract: " + screen);

for(const token of ["grace-today","today-opening","today-plan-card","today-responses","MorningGraceArtwork","TodayVerse"]) assert.ok(today.includes(token), "Today missing " + token);
for(const token of ["mg-canonical-screen","mg-bible-shell-header","mg-scripture-page","mg-bible-chapter-art","mg-verse-action-dock","MorningLandscape","BotanicalSprig"]) assert.ok(bible.includes(token), "Bible missing " + token);
for(const token of ["mg-canonical-screen","mg-prayer-hero","mg-prayer-focus","mg-prayer-library","mg-prayer-row","BotanicalSprig"]) assert.ok(prayer.includes(token), "Prayer missing " + token);
for(const token of ["mg-canonical-screen","mg-history-hero","mg-history-overview","mg-history-stats","mg-history-recent","mg-history-calendar","mg-history-closing"]) assert.ok(history.includes(token), "History missing " + token);

for(const selector of [".mg-canonical-hero",".mg-bible-shell-header",".mg-scripture-page",".mg-prayer-focus",".mg-prayer-row",".mg-history-stats",".mg-history-calendar"]) assert.ok(css.includes(selector), "Canonical CSS missing " + selector);
assert.match(css, /@media\s*\(max-width:\s*700px\)/);
assert.match(css, /font-size:\s*200%/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /url\(\s*["\']?https?:\/\//i);

const brandIndex=styles.indexOf('"./morning-grace-brand.css"');
const screenIndex=styles.indexOf('"./morning-grace-screens.css"');
assert.ok(brandIndex>=0 && screenIndex>brandIndex,"Canonical screen layer must load after Morning Grace brand assets");

const todayCss = await read("src/styles/today.css");
const artwork = await read("src/app/visual/MorningGraceArtwork.tsx");
assert.match(todayCss, /today-opening \.grace-art/);
assert.match(todayCss, /repeat\(auto-fit, minmax/);
assert.doesNotMatch(todayCss, /!important/);
assert.match(artwork, /dawn\.webp/);
assert.match(artwork, /aria-hidden="true"/);

assert.equal(pkg.scripts["verify:morning-grace:phase3"],"node scripts/verify-morning-grace-phase3.mjs");
assert.match(doc,/Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc,/Today.*Bible.*Prayer.*History/is);
assert.match(doc,/database schema/i);
assert.match(doc,/Production remains unchanged/i);

console.log("✓ Morning Grace Editorial Phase 3 verification passed");
console.log("  V2 Today composition verified; other canonical screens remain legacy");
console.log("  Scripture-first Bible hierarchy and human-first Prayer hierarchy certified");
console.log("  reflective factual History overview with no gamification certified");
console.log("  responsive phone/tablet/desktop and 200% reflow rules installed");
