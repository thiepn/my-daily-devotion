import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [visualRaw, tokens, base, shell, screens, scripture, phase4, phase5, phase6, phase7, phase8, app, main] = await Promise.all([
  read("canonical/visual-system.v1.json"), read("src/styles/tokens.css"), read("src/styles/base.css"), read("src/styles/shell.css"), read("src/styles/screens.css"), read("src/styles/scripture.css"), read("src/styles/phase4.css"), read("src/styles/phase5.css"), read("src/styles/phase6.css"), read("src/styles/phase7.css"), read("src/styles/phase8.css"), read("src/app/App.tsx"), read("src/main.tsx"),
]);
const visual = JSON.parse(visualRaw);
assert.equal(visual.version, 1); assert.equal(visual.character, "quiet-editorial-reading-journal"); assert.equal(visual.typography.remoteFontDependency, false); assert.deepEqual(visual.navigation.primaryItems, ["Today", "Bible", "Prayer", "History"]); assert.ok(visual.forbiddenPatterns.includes("decorative-gradients"));
const css = [tokens, base, shell, screens, scripture, phase4, phase5, phase6, phase7, phase8].join("\n");
assert.match(tokens, /prefers-color-scheme:\s*dark/); assert.match(tokens, /data-theme="dark"/); assert.match(tokens, /data-theme="light"/); assert.match(base, /prefers-reduced-motion:\s*reduce/); assert.match(shell, /\.mobile-nav/); assert.match(shell, /max-width:\s*860px/); assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i); assert.doesNotMatch(css, /url\(\s*["']?https?:\/\//i); assert.doesNotMatch(css, /box-shadow\s*:/i);
for (const label of ["Today", "Bible", "Prayer", "History"]) assert.match(app, new RegExp(`label: \\"${label}\\"`));
for (const importPath of ["tokens.css", "base.css", "shell.css", "screens.css", "scripture.css", "phase4.css", "phase5.css", "phase6.css", "phase7.css", "phase8.css"]) assert.ok(main.includes(importPath), `main.tsx must import ${importPath}`);
assert.ok(!main.includes("foundation.css"));
console.log("✓ Phase 2 visual-system verification passed"); console.log("  quiet editorial visual direction frozen"); console.log("  authored light/dark/system theme support"); console.log("  no remote fonts, gradients, or default shadows"); console.log("  responsive desktop rail + mobile bottom navigation");
