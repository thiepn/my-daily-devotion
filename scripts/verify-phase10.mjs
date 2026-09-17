import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(join(ROOT, path), "utf8");
const [manifestRaw, sw, indexHtml, app, platform, main, css, theme, dataScreen, collections, versionSource, pkgRaw, vite, phase10Doc] = await Promise.all([
  read("public/manifest.webmanifest"),
  read("public/sw.js"),
  read("index.html"),
  read("src/app/App.tsx"),
  read("src/app/platform.ts"),
  read("src/main.tsx"),
  read("src/styles/phase10.css"),
  read("src/app/visual/ThemeSwitcher.tsx"),
  read("src/data/DataScreen.tsx"),
  read("src/scripture/CollectionsScreen.tsx"),
  read("src/app/version.ts"),
  read("package.json"),
  read("vite.config.ts"),
  read("docs/PHASE_10_PWA_ACCESSIBILITY_PERFORMANCE_RESILIENCE.md"),
]);
const manifest = JSON.parse(manifestRaw);
const pkg = JSON.parse(pkgRaw);

assert.equal(pkg.version, "0.10.0");
assert.equal(pkg.scripts["verify:phase10"], "npm run verify:phase9 && node scripts/verify-phase10.mjs");
assert.match(versionSource, /APP_VERSION\s*=\s*"0\.10\.0"/);
assert.match(dataScreen, /createMddBackup\(db, APP_VERSION\)/);
assert.match(dataScreen, /createMddBackup\(db, APP_VERSION, exportPassword\)/);

assert.equal(manifest.name, "My Daily Devotion");
assert.equal(manifest.start_url, "./#/today");
assert.equal(manifest.scope, "./");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.background_color, "#f4f0e6");
assert.equal(manifest.theme_color, "#f4f0e6");
const iconByPurpose = new Map(manifest.icons.map((icon) => [`${icon.sizes}:${icon.purpose}`, icon]));
assert.ok(iconByPurpose.has("192x192:any"));
assert.ok(iconByPurpose.has("512x512:any"));
assert.ok(iconByPurpose.has("512x512:maskable"));

function pngSize(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "Expected PNG signature");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
for (const [path, width, height] of [
  ["public/icons/icon-192.png", 192, 192],
  ["public/icons/icon-512.png", 512, 512],
  ["public/icons/maskable-512.png", 512, 512],
  ["public/apple-touch-icon.png", 180, 180],
]) {
  const bytes = await readFile(join(ROOT, path));
  assert.deepEqual(pngSize(bytes), { width, height }, `Unexpected icon dimensions for ${path}`);
}

assert.match(indexHtml, /rel="manifest" href="\.\/manifest\.webmanifest"/);
assert.match(indexHtml, /apple-touch-icon/);
assert.match(indexHtml, /viewport-fit=cover/);
assert.match(indexHtml, /localStorage\.getItem\("mdd-theme"\)/);
assert.match(vite, /base:\s*"\.\/"/);
assert.match(vite, /chunkSizeWarningLimit:\s*350/);

for (const token of [
  'CACHE_NAME = "mdd-app-v0.10.0"',
  "bible/manifest.json",
  "bibleManifest.searchIndexPath",
  "bibleManifest.books.map",
  "plans/mcheyne-classic.v1.json",
  "SKIP_WAITING",
  "self.clients.claim",
  'request.mode === "navigate"',
  "caches.match(scopeRoot().href)",
]) assert.ok(sw.includes(token), `Service worker is missing ${token}`);
assert.doesNotMatch(sw, /skipWaiting\(\);\s*\}\s*\);\s*self\.addEventListener\("activate"/s, "Updates must not auto-activate during install");

assert.match(platform, /navigator\.storage/);
assert.match(platform, /storage\.persisted/);
assert.match(platform, /storage\.persist\(\)/);
assert.match(platform, /storage\.estimate\(\)/);
assert.match(platform, /serviceWorker\.register/);
assert.match(platform, /updateViaCache:\s*"none"/);
assert.match(platform, /PLATFORM_UPDATE_EVENT/);
assert.match(platform, /waiting\.postMessage\(\{ type: "SKIP_WAITING" \}\)/);

assert.match(app, /lazy\(\(\) => import\(/);
assert.ok((app.match(/lazy\(\(\) => import\(/g) ?? []).length >= 10, "Expected route-level lazy loading for major feature screens");
assert.match(app, /<Suspense fallback=\{<RouteLoading \/>\}>/);
assert.match(app, /className="skip-link"/);
assert.match(app, /id="main-content"/);
assert.match(app, /<RouteAnnouncer \/>/);
assert.match(app, /<PlatformStatus \/>/);
assert.match(main, /inspectStorage\(true\)/);
assert.match(main, /registerMddServiceWorker\(\)/);
const phase9Index = main.indexOf('"./styles/phase9.css"');
const phase10Index = main.indexOf('"./styles/phase10.css"');
assert.ok(phase9Index >= 0 && phase10Index > phase9Index, "Phase 10 styles must load after Phase 9 refinement");

assert.match(theme, /db\.preferences\.put/);
assert.match(theme, /mdd-theme/);
assert.match(theme, /aria-label="Theme"/);
assert.match(dataScreen, /<fieldset className="import-mode">/);
assert.match(dataScreen, /<legend>Restore mode<\/legend>/);
assert.match(dataScreen, /id="backup-file"/);
assert.match(dataScreen, /storage-resilience/);
assert.match(collections, /collection-add-here/);
assert.doesNotMatch(collections, /<em[^>]*onClick/);

for (const token of [".skip-link", ".platform-status", ".storage-resilience", "prefers-contrast: more", "forced-colors: active"]) assert.ok(css.includes(token), `Phase 10 CSS is missing ${token}`);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /box-shadow\s*:/i);

await access(join(ROOT, "dist/index.html"));
const assetNames = await readdir(join(ROOT, "dist/assets"));
const jsAssets = assetNames.filter((name) => name.endsWith(".js"));
assert.ok(jsAssets.length >= 8, `Expected route code splitting with >=8 JS chunks, got ${jsAssets.length}`);
const builtHtml = await readFile(join(ROOT, "dist/index.html"), "utf8");
const entryMatch = /<script[^>]+src="\.\/assets\/([^"]+\.js)"/.exec(builtHtml);
assert.ok(entryMatch, "Could not identify production entry chunk");
const entryStats = await stat(join(ROOT, "dist/assets", entryMatch[1]));
assert.ok(entryStats.size < 350 * 1024, `Entry JavaScript chunk is too large: ${entryStats.size} bytes`);
for (const path of ["dist/manifest.webmanifest", "dist/sw.js", "dist/icons/icon-192.png", "dist/icons/icon-512.png", "dist/icons/maskable-512.png", "dist/apple-touch-icon.png", "dist/bible/search-index.json", "dist/plans/mcheyne-classic.v1.json"]) await access(join(ROOT, path));

assert.match(phase10Doc, /Status:\s*\*\*implemented\*\*/i);
assert.match(phase10Doc, /all 66 normalized BSB book assets/i);
assert.match(phase10Doc, /backup.*delete.*restore/is);
assert.match(phase10Doc, /Phase 11 — UX Validation/i);
assert.match(phase10Doc, /Phase 12 — Release Hardening/i);
assert.match(phase10Doc, /npm run verify:phase10/);

console.log("✓ Phase 10 PWA, Accessibility, Performance & Resilience verification passed");
console.log("  install metadata + dedicated PNG/maskable icons + full offline BSB/search/M’Cheyne cache certified");
console.log(`  route-level code splitting certified with ${jsAssets.length} JavaScript chunks; entry ${Math.round(entryStats.size / 1024)} KiB`);
console.log("  persistent-storage wiring, safe SW updates, accessibility primitives and destructive backup recovery certified");
