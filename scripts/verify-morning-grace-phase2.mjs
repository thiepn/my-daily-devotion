import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [contractRaw, brandMark, icons, motifs, css, publicMark, publicSprig, publicSunrise, publicLandscape, manifestRaw, indexHtml, main, doc] = await Promise.all([
  read("canonical/morning-grace-brand-assets.v1.json"),
  read("src/app/visual/BrandMark.tsx"),
  read("src/app/visual/Icon.tsx"),
  read("src/app/visual/MorningGraceMotifs.tsx"),
  read("src/styles/morning-grace-brand.css"),
  read("public/brand-mark.svg"),
  read("public/brand/morning-grace-sprig.svg"),
  read("public/brand/morning-grace-sunrise.svg"),
  read("public/brand/morning-grace-landscape.svg"),
  read("public/manifest.webmanifest"),
  read("index.html"),
  read("src/main.tsx"),
  read("docs/PHASE_2_MORNING_GRACE_BRAND_ASSETS.md"),
]);

const themeSwitcher = await read("src/app/visual/ThemeSwitcher.tsx");
const contract = JSON.parse(contractRaw);
const manifest = JSON.parse(manifestRaw);

assert.equal(contract.version, 1);
assert.equal(contract.name, "Morning Grace Brand Assets");
assert.equal(contract.status, "phase-2-frozen");
assert.equal(contract.mark.name, "Morning Sprig Book");
assert.equal(contract.iconography.gridPx, 20);
assert.equal(contract.iconography.strokeWidthPx, 1.55);
assert.equal(contract.botanicals.density, "low");
assert.ok(contract.landscapeArt.prohibited.includes("embedded-text"));
assert.ok(contract.landscapeArt.prohibited.includes("people-as-subject"));
assert.ok(contract.phaseBoundary.finalizedNow.includes("brand-mark"));
assert.ok(contract.phaseBoundary.finalizedNow.includes("icon-family"));

for (const token of ["Scripture", "daily growth", "morning sun", "color-morning", "color-accent-strong"]) {
  assert.ok(brandMark.includes(token), `BrandMark missing ${token}`);
}
for (const icon of ["today","bible","prayer","history","leaf","sprig","reflection","answered","people","highlight","share","more","settings"]) {
  assert.ok(icons.includes(`"${icon}"`), `Icon family missing ${icon}`);
}
for (const component of ["BotanicalSprig","SunriseOrnament","MorningLandscape","EditorialFlourish"]) {
  assert.ok(motifs.includes(`function ${component}`), `Motif library missing ${component}`);
}
for (const selector of [".mg-sprig",".mg-sunrise",".mg-landscape",".mg-flourish",".nav-link.active .icon-prayer"]) {
  assert.ok(css.includes(selector), `Brand CSS missing ${selector}`);
}

for (const svg of [publicMark, publicSprig, publicSunrise, publicLandscape]) {
  assert.doesNotMatch(svg, /(?:linear|radial|conic)-gradient/i);
  assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["']https?:\/\//i);
}
assert.match(publicMark, /F6F2E9/);
assert.match(publicMark, /D29A3A/);
assert.match(publicLandscape, /viewBox="0 0 720 280"/);

assert.equal(manifest.background_color, "#f6f2e9");
assert.equal(manifest.theme_color, "#f6f2e9");
assert.match(indexHtml, /name="theme-color" content="#f6f2e9"/);
assert.match(indexHtml, /"#171b18" : "#f6f2e9"/);
assert.match(themeSwitcher, /LIGHT_THEME_COLOR = "#f6f2e9"/);
assert.match(themeSwitcher, /DARK_THEME_COLOR = "#171b18"/);
assert.match(themeSwitcher, /prefers-color-scheme: dark/);

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137,80,78,71,13,10,26,10], "Expected PNG signature");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
for (const [path, width, height] of [
  ["public/icons/icon-192.png", 192, 192],
  ["public/icons/icon-512.png", 512, 512],
  ["public/icons/maskable-512.png", 512, 512],
  ["public/apple-touch-icon.png", 180, 180],
]) {
  const bytes = await readFile(new URL(path, root));
  assert.ok(bytes.length > 1000, `${path} must be a non-empty Morning Grace raster asset`);
  assert.deepEqual(pngDimensions(bytes), { width, height }, `Unexpected Morning Grace icon dimensions for ${path}`);
}

const phase1Index = main.indexOf('"./styles/morning-grace.css"');
const phase2Index = main.indexOf('"./styles/morning-grace-brand.css"');
assert.ok(phase1Index >= 0 && phase2Index > phase1Index, "Morning Grace brand assets must load after the Phase 1 foundation");

assert.match(doc, /Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc, /Morning Sprig Book/);
assert.match(doc, /ingredients.*not the final screen compositions/is);
assert.match(doc, /No database.*changes/is);

console.log("✓ Morning Grace Editorial Phase 2 verification passed");
console.log("  Morning Sprig Book mark + PWA icon family frozen");
console.log("  editorial 20px icon family frozen");
console.log("  botanical, sunrise and landscape motif system frozen");
console.log("  generated-art direction and dark-mode asset rules documented");
console.log("  canonical screen compositions remain deferred");
