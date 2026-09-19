import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [legacyVisualRaw, morningRaw, tokens, base, shell, screens, scripture, phase4, phase5, phase6, phase7, phase8, morning, app, main] = await Promise.all([
  read("canonical/visual-system.v1.json"),
  read("canonical/morning-grace-design-language.v1.json"),
  read("src/styles/tokens.css"),
  read("src/styles/base.css"),
  read("src/styles/shell.css"),
  read("src/styles/screens.css"),
  read("src/styles/scripture.css"),
  read("src/styles/phase4.css"),
  read("src/styles/phase5.css"),
  read("src/styles/phase6.css"),
  read("src/styles/phase7.css"),
  read("src/styles/phase8.css"),
  read("src/styles/morning-grace.css"),
  read("src/app/App.tsx"),
  read("src/main.tsx"),
]);
const legacyVisual = JSON.parse(legacyVisualRaw);
const morningGrace = JSON.parse(morningRaw);

assert.equal(legacyVisual.version, 1);
assert.equal(morningGrace.version, 1);
assert.equal(morningGrace.name, "Morning Grace Editorial");
assert.equal(morningGrace.character, "warm-scripture-first-editorial-devotional");
assert.equal(morningGrace.typography.remoteFontDependency, false);
assert.deepEqual(morningGrace.navigation.primaryItems, ["Today", "Bible", "Prayer", "History"]);
assert.ok(morningGrace.forbiddenPatterns.includes("decorative-gradients"));
assert.ok(morningGrace.forbiddenPatterns.includes("glassmorphism"));
assert.ok(morningGrace.forbiddenPatterns.includes("generic-ai-saas-layout"));

const css = [tokens, base, shell, screens, scripture, phase4, phase5, phase6, phase7, phase8, morning].join("\n");
assert.match(tokens, /prefers-color-scheme:\s*dark/);
assert.match(tokens, /data-theme="dark"/);
assert.match(tokens, /data-theme="light"/);
assert.match(tokens, /--font-display:/);
assert.match(tokens, /--font-reading:/);
assert.match(tokens, /--color-canvas:\s*#f6f2e9/);
assert.match(tokens, /--color-prayer:\s*#b86c4d/);
assert.match(base, /prefers-reduced-motion:\s*reduce/);
assert.match(shell, /\.mobile-nav/);
assert.match(shell, /max-width:\s*860px/);
assert.match(morning, /backdrop-filter:\s*none/);
assert.match(morning, /box-shadow:\s*var\(--shadow-soft\)/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /url\(\s*["']?https?:\/\//i);

for (const label of ["Today", "Bible", "Prayer", "History"]) assert.match(app, new RegExp(`label: \\"${label}\\"`));
for (const importPath of ["tokens.css", "base.css", "shell.css", "screens.css", "scripture.css", "phase4.css", "phase5.css", "phase6.css", "phase7.css", "phase8.css", "morning-grace.css"]) {
  assert.ok(main.includes(importPath), `main.tsx must import ${importPath}`);
}
assert.ok(!main.includes("foundation.css"));

console.log("✓ Phase 2 visual-system verification passed");
console.log("  legacy quiet-editorial artifacts retained for history");
console.log("  Morning Grace Editorial is the active visual contract");
console.log("  authored light/dark/system theme support with no remote font dependency");
console.log("  no decorative gradients or remote CSS assets; mobile glass removed");
