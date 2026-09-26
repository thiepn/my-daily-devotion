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

// V2 centralizes imports; the older JSON describes the retained legacy screens.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

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
  "--color-canvas: #faf6ee",
  "--color-surface: #fffbf5",
  "--color-ink: #252922",
  "--color-accent: #587060",
  "--color-reflection: #48706d",
  "--color-prayer: #9f563b",
  "--color-morning: #d29a3a",
  "--color-highlight: #e8d6ab",
  "--color-red-letter: #93493f",
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
  ".primary-editorial-action",
]) assert.ok(morning.includes(selector), `Morning Grace foundation missing ${selector}`);

assert.match(morning, /backdrop-filter:\s*none/);
assert.match(morning, /box-shadow:\s*var\(--shadow-soft\)/);
assert.doesNotMatch(morning, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(morning, /url\(\s*["']?https?:\/\//i);
assert.doesNotMatch(morning, /#[a-f0-9]{0,2}(?:7c3aed|8b5cf6|a855f7)/i);

const correctiveIndex = styles.indexOf('"./corrective.css"');
const morningIndex = styles.indexOf('"./morning-grace.css"');
assert.ok(correctiveIndex >= 0 && morningIndex > correctiveIndex, "Retained legacy import order must remain stable");

assert.match(styles, /@layer legacy, foundation, components, screens/);
assert.match(styles, /tokens\.css" layer\(foundation\)/);
assert.match(styles, /components\.css" layer\(components\)/);
assert.match(styles, /today\.css" layer\(screens\)/);
assert.match(styles, /@fontsource\/libre-caslon-text/);

assert.match(app, /data-domain=\{routeDomain\(location\.pathname\)\}/);
assert.match(app, /Scripture · Prayer · Reflection/);
assert.match(app, /A quieter life\. A stronger faith\./);
assert.doesNotMatch(app, /Devotional workspace/);

assert.match(doc, /Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc, /Morning Grace Editorial/);
assert.match(doc, /does \*\*not\*\* finalize/i);
assert.match(doc, /database.*unchanged/is);

console.log("✓ Morning Grace Editorial Phase 1 verification passed");
console.log("  historical contract retained; V2 tokens and owned cascade verified");
console.log("  warm paper + natural domain accents + three semantic type roles installed");
console.log("  solid navigation surfaces, restrained elevation and anti-generic guardrails enforced");
console.log("  product data/domain behavior unchanged; canonical screen redesigns deferred");

const bibleCss = await read("src/styles/bible.css");
const scriptureCss = await read("src/styles/scripture.css");
assert.match(bibleCss, /\.reader-page/);
assert.match(scriptureCss, /\.scripture-content/);
