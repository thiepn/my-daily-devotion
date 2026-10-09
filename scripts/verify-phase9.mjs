import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [css, main, app, dataScreen, pkgRaw, phase9Doc] = await Promise.all([
  read("src/styles/controls.css"),
  read("src/main.tsx"),
  read("src/app/App.tsx"),
  read("src/data/DataScreen.tsx"),
  read("package.json"),
  read("docs/PHASE_9_UI_REFINEMENT.md"),
]);
// Visual imports moved to the single layered entrypoint; domain gates are unchanged.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

const pkg = JSON.parse(pkgRaw);

assert.ok(styles.includes("components.css") && styles.includes("archive.css"));

assert.match(app, /Scripture · Prayer · Reflection/);
assert.ok(app.includes("A quieter life. A stronger faith."));
assert.doesNotMatch(app, /Devotional workspace/);
assert.match(app, /className=\{\(\{ isActive \}\) => `nav-link\$\{isActive \? " active" : ""\}`\}/);
assert.doesNotMatch(app, /Phase 8|History, Search & Portability/);

assert.match(await read("src/styles/shell.css"), /\.utility-context/);
assert.match(await read("src/styles/prayer.css"), /\.prayer-journal-tabs/);
assert.match(await read("src/styles/history.css"), /\.history-journal-tabs/);
// Bible chrome now has one owner instead of an override in Phase 9.
assert.match(await read("src/styles/bible.css"), /\.verse-action-dock/);

assert.match(await read("src/styles/writing.css"), /max-width:760px/);
assert.match(await read("src/styles/writing.css"), /\.journal-context/);
assert.match(await read("src/styles/writing.css"), /\.journal-prompts button/);

const version = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(pkg.version);
assert.ok(version, `Expected semantic package version, got ${pkg.version}`);
assert.ok(Number(version[1]) > 0 || Number(version[2]) >= 9, `Phase 9 requires app version >=0.9.0, got ${pkg.version}`);
assert.equal(pkg.scripts["verify:phase9"], "npm run verify:phase8 && node scripts/verify-phase9.mjs");
// The fourth argument is the explicitly opted-in recovery flag; ordinary
// encrypted exports keep that flag false by default.
assert.match(dataScreen, /generateMddBackup\(db, APP_VERSION, password, withRecovery\)/);
assert.match(dataScreen, /withRecovery = false/);
assert.match(dataScreen, /setIncludeRecovery\(event.target.checked\)/);
assert.match(dataScreen, /commitMddRestore/);
assert.match(await read("src/styles/data.css"), /\.data-panel/);

assert.match(phase9Doc, /Status:\s*\*\*implemented\*\*/i);
assert.match(phase9Doc, /Phase 10/i);
assert.match(phase9Doc, /PWA/i);
assert.match(phase9Doc, /UX validation/i);
assert.match(phase9Doc, /npm run verify:phase9/);

console.log("✓ Phase 9 Dedicated UI Refinement verification passed");
console.log("  product chrome replaces development-phase labels while preserving navigation and utilities");
console.log("  controls, forms, action groups, density and empty states share one editorial refinement layer");
console.log("  phone, tablet, desktop, wide master/detail and short-landscape compositions are explicitly covered");

assert.match(await read("src/styles/writing.css"), /\.journal-prompts button/);

assert.match(await read("src/styles/prayer-metadata.css"), /\.directory-list/);

// Archive compositions have migrated out of legacy CSS.
assert.match(await read("src/styles/archive.css"), /\.archive-segments/);
assert.match(await read("src/styles/archive.css"), /\.collection-journal-item/);
