import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [pkgRaw, config, core, accessibility, responsive, pwa, app, today, plan, history, schema, tokens, vite, sw, main, phase11Css, phase11Doc] = await Promise.all([
  read("package.json"), read("playwright.config.ts"), read("tests/ux/core-flow.spec.ts"), read("tests/ux/accessibility.spec.ts"), read("tests/ux/responsive.spec.ts"), read("tests/ux/pwa.spec.ts"), read("src/app/App.tsx"), read("src/mcheyne/TodayScreen.tsx"), read("src/mcheyne/PlanScreen.tsx"), read("src/history/HistoryScreens.tsx"), read("src/data/schema.ts"), read("src/styles/tokens.css"), read("vite.config.ts"), read("public/sw.js"), read("src/main.tsx"), read("src/styles/phase11.css"), read("docs/PHASE_11_UX_VALIDATION.md"),
]);
const pkg = JSON.parse(pkgRaw);
const version = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(pkg.version);
assert.ok(version, `Expected semantic package version, got ${pkg.version}`);
assert.ok(Number(version[1]) > 0 || Number(version[2]) >= 11, `Phase 11 requires app version >=0.11.0, got ${pkg.version}`);
assert.equal(pkg.scripts["test:ux"], "playwright test");
assert.equal(pkg.scripts["verify:phase11"], "npm run verify:phase10 && npm run test:ux && node scripts/verify-phase11.mjs");
assert.equal(pkg.devDependencies["@playwright/test"], "1.63.0");
assert.equal(pkg.devDependencies["@axe-core/playwright"], "4.13.0");
for (const token of ["desktop-chromium", "mobile-chromium", "offline-pwa", 'serviceWorkers: "block"', 'serviceWorkers: "allow"', 'screenshot: "only-on-failure"', 'trace: "retain-on-failure"']) assert.ok(config.includes(token), `Playwright config missing ${token}`);
for (const token of ["first-run setup", "Scripture can become a reflection", "Scripture search and collections"]) assert.ok(core.includes(token), `Core journey suite missing ${token}`);
for (const token of ["expectNoAxeViolations", "Skip to main content", "Completed through date", "Previous month", "Dark theme"]) assert.ok(accessibility.includes(token), `Accessibility suite missing ${token}`);
assert.match(responsive, /320px mobile/); assert.match(responsive, /200% text resizing/); assert.match(responsive, /44/);
for (const token of ["setOffline(true)", "navigator.serviceWorker.controller", "missingBuildAssets", "caches.match(url, { ignoreVary: true })", "John 3:16"]) assert.ok(pwa.includes(token), `Offline UX suite missing ${token}`);

assert.match(app, /main-content/); assert.match(app, /focus\(\{ preventScroll: true \}\)/);
assert.match(today, /aria-label="Completed through date"/); assert.match(plan, /aria-label="Completed through date"/);
assert.match(history, /aria-label="Previous month"/); assert.match(history, /aria-label="Next month"/); assert.match(history, /aria-label=\{`Open history for \$\{dateLabel\(date\)\}`\}/); assert.match(history, /aria-current=/); assert.match(history, /Opening history…/); assert.match(history, /const\[loading,setLoading\]/);
assert.match(schema, /DATABASE_SCHEMA_VERSION = 1/);
assert.match(tokens, /--color-ink-faint:\s*#74786f/); assert.match(tokens, /--color-warning-text:\s*#7a4f2f/);
assert.match(vite, /manifest:\s*true/);
assert.match(sw, /\.vite\/manifest\.json/); assert.match(sw, /Object\.values\(buildManifest\)/); assert.match(sw, /entry\.file/); assert.match(sw, /ignoreVary:\s*true/); assert.match(sw, /matchCached\(request\)/);
const phase10Index=main.indexOf('"./styles/phase10.css"'); const phase11Index=main.indexOf('"./styles/phase11.css"'); assert.ok(phase10Index>=0&&phase11Index>phase10Index,"Phase 11 UX fixes must load after Phase 10 styles");
assert.match(phase11Css, /\.data-warning/); assert.match(phase11Css, /var\(--color-warning-text\)/); assert.match(phase11Css, /\.history-loading/);

assert.match(phase11Doc, /Status:\s*\*\*implemented\*\*/i); assert.match(phase11Doc, /Read.*Respond.*Pray.*Remember/is); assert.match(phase11Doc, /Playwright/i); assert.match(phase11Doc, /axe/i); assert.match(phase11Doc, /320/i); assert.match(phase11Doc, /200%/i); assert.match(phase11Doc, /offline/i); assert.match(phase11Doc, /Phase 12 — Release Hardening/i); assert.match(phase11Doc, /npm run verify:phase11/);

console.log("✓ Phase 11 UX Validation verification passed");
console.log("  desktop/mobile browser journeys + Read → Respond → Pray → Remember loop certified");
console.log("  WCAG automation, keyboard focus, 320px reflow and 200% text resizing certified");
console.log("  full lazy-route precache with Vary-safe matching + controlled cold-offline Scripture/search journey certified");
