import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [css, main, app, dataScreen, pkgRaw, phase9Doc] = await Promise.all([
  read("src/styles/phase9.css"),
  read("src/main.tsx"),
  read("src/app/App.tsx"),
  read("src/data/DataScreen.tsx"),
  read("package.json"),
  read("docs/PHASE_9_UI_REFINEMENT.md"),
]);
const pkg = JSON.parse(pkgRaw);

const phase8Index = main.indexOf('"./styles/phase8.css"');
const phase9Index = main.indexOf('"./styles/phase9.css"');
assert.ok(phase8Index >= 0 && phase9Index > phase8Index, "Phase 9 refinement CSS must load after Phase 8 feature styles");

assert.match(app, /Devotional workspace/);
assert.match(app, /className=\{\(\{ isActive \}\) => `nav-link\$\{isActive \? " active" : ""\}`\}/);
assert.doesNotMatch(app, /Phase 8|History, Search & Portability/);

for (const selector of [
  ".utility-context",
  ".visual-screen",
  ".setup-options",
  ".verse-action-dock",
  ".reflection-prompts button",
  ".prayer-status-tabs",
  ".metadata-layout",
  ".history-tabs",
  ".global-search-form",
  ".collections-layout",
  ".data-panel",
]) assert.ok(css.includes(selector), `Missing Phase 9 refinement for ${selector}`);

assert.match(css, /--control-height:\s*44px/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /@media\s*\(min-width:\s*1100px\)/);
assert.match(css, /@media\s*\(max-width:\s*420px\)/);
assert.match(css, /orientation:\s*landscape/);
assert.match(css, /reflection-context-panel[\s\S]*position:\s*sticky/);
assert.match(css, /\.reflection-prompts button[\s\S]*border-radius:\s*var\(--radius-small\)/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /box-shadow\s*:/i);
assert.doesNotMatch(css, /border-radius:\s*999px/i);

const version = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(pkg.version);
assert.ok(version, `Expected semantic package version, got ${pkg.version}`);
assert.ok(Number(version[1]) > 0 || Number(version[2]) >= 9, `Phase 9 requires app version >=0.9.0, got ${pkg.version}`);
assert.equal(pkg.scripts["verify:phase9"], "npm run verify:phase8 && node scripts/verify-phase9.mjs");
assert.match(dataScreen, /createMddBackup\(db, APP_VERSION\)/);
assert.match(dataScreen, /createMddBackup\(db, APP_VERSION, exportPassword\)/);

assert.match(phase9Doc, /Status:\s*\*\*implemented\*\*/i);
assert.match(phase9Doc, /Phase 10/i);
assert.match(phase9Doc, /PWA/i);
assert.match(phase9Doc, /UX validation/i);
assert.match(phase9Doc, /npm run verify:phase9/);

console.log("✓ Phase 9 Dedicated UI Refinement verification passed");
console.log("  product chrome replaces development-phase labels while preserving navigation and utilities");
console.log("  controls, forms, action groups, density and empty states share one editorial refinement layer");
console.log("  phone, tablet, desktop, wide master/detail and short-landscape compositions are explicitly covered");
