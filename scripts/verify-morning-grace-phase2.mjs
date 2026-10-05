import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [contractRaw, brandMark, icons, motifs, css, publicMark, publicSprig, publicSunrise, publicLandscape, manifestRaw, indexHtml, main, doc] = await Promise.all([
  read("canonical/morning-grace-brand-assets.v1.json"),
  read("src/app/visual/BrandMark.tsx"),
  read("src/app/visual/Icon.tsx"),
  read("src/app/visual/MorningGraceArtwork.tsx"),
  read("src/styles/components.css"),
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
// V2 centralizes imports; the older JSON describes the retained legacy screens.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

const contract = JSON.parse(contractRaw);
const manifest = JSON.parse(manifestRaw);

assert.equal(contract.version, 1);
assert.equal(contract.name, "Morning Grace Brand Assets");
assert.equal(contract.status, "legacy-screen-contract-with-approved-brand");
assert.equal(contract.mark.name, "Cream Forest Book and Cross");
assert.equal(createHash("sha256").update(await readFile(new URL(contract.mark.source, root))).digest("hex"), contract.mark.sourceSha256);
assert.equal(contract.iconography.gridPx, 20);
assert.equal(contract.iconography.strokeWidthPx, 1.55);
assert.equal(contract.botanicals.density, "low");
assert.ok(contract.landscapeArt.prohibited.includes("embedded-text"));
assert.ok(contract.landscapeArt.prohibited.includes("people-as-subject"));
assert.ok(contract.phaseBoundary.finalizedNow.includes("brand-mark"));
assert.ok(contract.phaseBoundary.finalizedNow.includes("icon-family"));

for (const token of ["cream-forest-master.png", "icons/icon-192.png", "import.meta.env.BASE_URL", 'alt=""', 'aria-hidden="true"']) {
  assert.ok(brandMark.includes(token), `BrandMark missing ${token}`);
}
for (const icon of ["today","bible","prayer","history","leaf","sprig","reflection","answered","people","highlight","share","more","settings"]) {
  assert.ok(icons.includes(`"${icon}"`), `Icon family missing ${icon}`);
}
for(const asset of ['dawn.webp','bible-context.webp','history-reflection.webp','olive-sprig.webp','evening-valley.webp','evening-context.webp','evening-reflection.webp']) assert.ok(motifs.includes(asset), 'Missing bundled artwork '+asset);
assert.match(css, /\.grace-art/);
for (const svg of [publicMark, publicSprig, publicSunrise, publicLandscape]) {
  assert.doesNotMatch(svg, /(?:linear|radial|conic)-gradient/i);
  assert.doesNotMatch(svg, /(?:href|src)\s*=\s*["']https?:\/\//i);
}
assert.match(publicMark, /data:image\/png;base64,/);
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
  ["public/icons/favicon-16.png", 16, 16],
  ["public/icons/favicon-32.png", 32, 32],
]) {
  const bytes = await readFile(new URL(path, root));
  assert.ok(bytes.length > (width <= 32 ? 100 : 1000), `${path} must be a non-empty Morning Grace raster asset`);
  assert.deepEqual(pngDimensions(bytes), { width, height }, `Unexpected Morning Grace icon dimensions for ${path}`);
}

assert.ok(styles.includes("components.css"));

assert.match(doc, /Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc, /Morning Sprig Book/);
assert.match(doc, /ingredients.*not the final screen compositions/is);
assert.match(doc, /No database.*changes/is);

console.log("✓ Morning Grace Editorial Phase 2 verification passed");
console.log("  approved Cream Forest Book and Cross master + PWA/favicon sizes verified");
console.log("  editorial 20px icon family frozen");
console.log("  botanical, sunrise and landscape motif system frozen");
console.log("  generated-art direction and dark-mode asset rules documented");
console.log("  canonical screen compositions remain deferred");
