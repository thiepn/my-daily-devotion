import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [contractRaw, tokens, morning, app, main, doc] = await Promise.all([
  read("canonical/morning-grace-design-language.v1.json"),
  read("src/styles/tokens.css"),
  read("src/styles/morning-grace.css"),
  read("src/app/App.tsx"),
  read("src/main.tsx"),
  read("docs/PHASE_1_MORNING_GRACE_DESIGN_LANGUAGE.md"),
]);

const contract = JSON.parse(contractRaw);

assert.equal(contract.version, 1);
assert.equal(contract.name, "Morning Grace Editorial");
assert.equal(contract.character, "warm-scripture-first-editorial-devotional");
assert.equal(contract.status, "phase-1-frozen");
assert.equal(contract.typography.remoteFontDependency, false);
assert.deepEqual(contract.navigation.primaryItems, ["Today", "Bible", "Prayer", "History"]);
assert.ok(contract.forbiddenPatterns.includes("generic-ai-saas-layout"));
assert.ok(contract.forbiddenPatterns.includes("decorative-gradients"));
assert.ok(contract.forbiddenPatterns.includes("glassmorphism"));

for (const token of [
  "--font-display:",
  "--font-reading:",
  "--font-ui:",
  "--color-canvas: #f6f2e9",
  "--color-surface: #fcf9f3",
  "--color-ink: #20241f",
  "--color-accent: #587060",
  "--color-reflection: #48706d",
  "--color-prayer: #9f563b",
  "--color-morning: #d29a3a",
  "--color-highlight: #e8d6ab",
  "--radius-xs: 4px",
  "--radius-sm: 8px",
  "--radius-md: 12px",
  "--radius-lg: 18px",
  "--reading-max: 700px",
]) assert.ok(tokens.includes(token), `Morning Grace token missing: ${token}`);

for (const selector of [
  '.workspace[data-domain="today"]',
  '.workspace[data-domain="bible"]',
  '.workspace[data-domain="reflection"]',
  '.workspace[data-domain="prayer"]',
  '.workspace[data-domain="history"]',
  ".mobile-nav",
  ".reader-page",
  ".scripture-copy",
  ".primary-editorial-action",
]) assert.ok(morning.includes(selector), `Morning Grace foundation missing ${selector}`);

assert.match(morning, /backdrop-filter:\s*none/);
assert.match(morning, /box-shadow:\s*var\(--shadow-soft\)/);
assert.doesNotMatch(morning, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(morning, /url\(\s*["']?https?:\/\//i);
assert.doesNotMatch(morning, /#[a-f0-9]{0,2}(?:7c3aed|8b5cf6|a855f7)/i);

const correctiveIndex = main.indexOf('"./styles/corrective.css"');
const morningIndex = main.indexOf('"./styles/morning-grace.css"');
assert.ok(correctiveIndex >= 0 && morningIndex > correctiveIndex, "Morning Grace must be the final visual foundation layer");

assert.match(app, /data-domain=\{routeDomain\(location\.pathname\)\}/);
assert.match(app, /Scripture · Prayer · Reflection/);
assert.match(app, /A quieter life\. A stronger faith\./);
assert.doesNotMatch(app, /Devotional workspace/);

assert.match(doc, /Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc, /Morning Grace Editorial/);
assert.match(doc, /does \*\*not\*\* finalize/i);
assert.match(doc, /database.*unchanged/is);

console.log("✓ Morning Grace Editorial Phase 1 verification passed");
console.log("  design language frozen as machine-readable contract");
console.log("  warm paper + natural domain accents + three semantic type roles installed");
console.log("  solid navigation surfaces, restrained elevation and anti-generic guardrails enforced");
console.log("  product data/domain behavior unchanged; canonical screen redesigns deferred");
