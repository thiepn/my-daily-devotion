import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(join(ROOT, path), "utf8");
const [
  pkgRaw, lockRaw, versionSource, sw, manifestRaw, indexHtml, ci, gitignore,
  schema, changelog, privacyDoc, phase12Doc, releaseChecklist, releaseManifestRaw, sums,
] = await Promise.all([
  read("package.json"), read("package-lock.json"), read("src/app/version.ts"), read("public/sw.js"),
  read("public/manifest.webmanifest"), read("index.html"), read(".github/workflows/ci.yml"), read(".gitignore"),
  read("src/data/schema.ts"), read("CHANGELOG.md"), read("docs/PRIVACY_AND_DATA.md"),
  read("docs/PHASE_12_RELEASE_HARDENING.md"), read("docs/RELEASE_CHECKLIST.md"),
  read("release/release-manifest.json"), read("release/SHA256SUMS"),
]);

const pkg = JSON.parse(pkgRaw);
const lock = JSON.parse(lockRaw);
const manifest = JSON.parse(manifestRaw);
const releaseManifest = JSON.parse(releaseManifestRaw);

assert.match(pkg.version, /^1\.\d+\.\d+$/, "Release version must remain within stable major version 1");
assert.equal(/APP_VERSION\s*=\s*"([^"]+)"/.exec(versionSource)?.[1], pkg.version);
assert.equal(/CACHE_NAME\s*=\s*"([^"]+)"/.exec(sw)?.[1], `mdd-app-v${pkg.version}`);
assert.equal(pkg.scripts["notices:build"], "node scripts/build-third-party-notices.mjs");
assert.match(pkg.scripts.build, /npm run notices:build/);
assert.equal(pkg.scripts["release:package"], "npm run build && node scripts/package-release.mjs");
assert.equal(pkg.scripts["audit:prod"], "npm audit --omit=dev --audit-level=high");
assert.equal(pkg.scripts["verify:phase12"], "node scripts/certify.mjs");
const certification = await read("scripts/certify.mjs");
for (const gate of ["verify-phase0.mjs", "typecheck", '"test:report"', '"build"', "test:ux", "verify-phase11.mjs", "package-release.mjs", "verify-phase12.mjs"]) assert.ok(certification.includes(gate), `Certification missing ${gate}`);
assert.match(certification, /phase = 2; phase <= 10/);

assert.equal(lock.lockfileVersion, 3);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages?.[""]?.version, pkg.version);
assert.deepEqual(lock.packages?.[""]?.dependencies, pkg.dependencies);
assert.deepEqual(lock.packages?.[""]?.devDependencies, pkg.devDependencies);
for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, `${name} must be pinned exactly for release builds`);
}

assert.equal(manifest.lang, "en");
assert.equal(manifest.dir, "ltr");
assert.equal(manifest.prefer_related_applications, false);
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./#/today");
assert.match(indexHtml, /Content-Security-Policy/);
assert.match(indexHtml, /connect-src 'self'/);
assert.match(indexHtml, /object-src 'none'/);
assert.match(indexHtml, /name="referrer" content="no-referrer"/);

assert.match(ci, /^name:\s*Release Certification CI/m);
assert.match(ci, /npm ci --ignore-scripts/);
assert.match(ci, /npm run audit:prod/);
assert.match(ci, /npm run verify:phase12/);
assert.match(ci, /name:\s*mdd-certified-release/);
assert.match(ci, /path:\s*release\//);
assert.doesNotMatch(ci, /npm install --ignore-scripts/);

for (const token of ["release/", "playwright-report/", "test-results/", "/public/THIRD_PARTY_NOTICES.txt"]) assert.ok(gitignore.includes(token), `.gitignore missing ${token}`);
assert.match(schema, /DATABASE_SCHEMA_VERSION\s*=\s*1/);
assert.match(changelog, /## 1\.0\.0 — 2026-09-17/);
assert.match(privacyDoc, /local-first/i);
assert.match(privacyDoc, /does not include analytics, advertising, social tracking/i);
assert.match(phase12Doc, /Status:\s*\*\*implemented\*\*/i);
assert.match(phase12Doc, /Phase 12.*final planned development phase/is);
assert.match(phase12Doc, /npm run verify:phase12/);
assert.match(releaseChecklist, /Ship only from a commit/i);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const distDir = join(ROOT, "dist");
await access(join(distDir, "index.html"));
await access(join(distDir, "THIRD_PARTY_NOTICES.txt"));
const notices = await readFile(join(distDir, "THIRD_PARTY_NOTICES.txt"), "utf8");
for (const token of ["Berean Standard Bible", "public domain", "dexie 4.4.6", "Apache-2.0", "react 19.3.0", "MIT", "react-router-dom 7.18.3", "fflate 0.8.3"]) assert.match(notices, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `Third-party notices missing ${token}`);

const distFiles = await collectFiles(distDir);
assert.ok(distFiles.length > 70, `Production package is unexpectedly small: ${distFiles.length} files`);
assert.equal(distFiles.filter((path) => path.endsWith(".map")).length, 0, "Production release must not ship source maps");

const textExtensions = /\.(?:html|js|css|json|webmanifest|svg|txt)$/i;
for (const absolute of distFiles.filter((path) => textExtensions.test(path))) {
  const text = await readFile(absolute, "utf8");
  const rel = relative(distDir, absolute).split(sep).join("/");
  assert.doesNotMatch(text, /sourceMappingURL=/, `${rel} contains a source-map pointer`);

  // Third-party vendor code and canonical content can legitimately contain words or
  // URLs that resemble development markers. Development-residue checks therefore
  // target MDD's own executable/shell assets while source-map checks remain global.
  const firstPartyCode =
    rel === "index.html" ||
    rel === "sw.js" ||
    rel === "manifest.webmanifest" ||
    rel === "brand-mark.svg" ||
    rel.endsWith(".css") ||
    (rel.startsWith("assets/") && rel.endsWith(".js") && !/(?:react|dexie)-vendor-/.test(rel));
  if (firstPartyCode) {
    assert.doesNotMatch(text, /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i, `${rel} contains a development host`);
    assert.doesNotMatch(text, /\b(?:TODO|FIXME|HACK)\b/, `${rel} contains development residue`);
  }
}

const artifactPath = join(ROOT, "release", releaseManifest.artifact);
const archive = await readFile(artifactPath);
const archiveSha = createHash("sha256").update(archive).digest("hex");
assert.equal(releaseManifest.product, "My Daily Devotion");
assert.equal(releaseManifest.version, pkg.version);
assert.equal(releaseManifest.databaseSchemaVersion, 1);
assert.equal(releaseManifest.sha256, archiveSha);
assert.equal(sums.trim(), `${archiveSha}  ${releaseManifest.artifact}`);
assert.equal(releaseManifest.archiveBytes, archive.byteLength);
assert.ok(releaseManifest.fileCount === distFiles.length);
assert.ok(archive.byteLength < 60 * 1024 * 1024, `Release archive exceeds 60 MiB: ${archive.byteLength}`);
if (process.env.GITHUB_SHA) assert.equal(releaseManifest.sourceCommit, process.env.GITHUB_SHA);

const zipped = unzipSync(new Uint8Array(archive));
const prefix = "my-daily-devotion/";
for (const relativePath of [
  "index.html", "manifest.webmanifest", "sw.js", "brand-mark.svg", "THIRD_PARTY_NOTICES.txt",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "apple-touch-icon.png",
  "bible/manifest.json", "bible/search-index.json", "plans/mcheyne-classic.v1.json",
]) assert.ok(zipped[`${prefix}${relativePath}`], `Release archive missing ${relativePath}`);

const bibleManifest = JSON.parse(await readFile(join(distDir, "bible/manifest.json"), "utf8"));
assert.equal(bibleManifest.books.length, 66);
assert.equal(bibleManifest.translationId, "BSB");
assert.ok(bibleManifest.totalVerses >= 31_000);
for (const book of bibleManifest.books) {
  const relativePath = book.path.replace(/^\//, "");
  assert.ok(zipped[`${prefix}${relativePath}`], `Release archive missing bundled BSB book ${book.id}`);
}
const searchIndex = JSON.parse(await readFile(join(distDir, "bible/search-index.json"), "utf8"));
assert.equal(searchIndex.length, 31_086);

const builtManifest = JSON.parse(await readFile(join(distDir, "manifest.webmanifest"), "utf8"));
assert.equal(builtManifest.name, "My Daily Devotion");
assert.equal(builtManifest.prefer_related_applications, false);
const artifactStats = await stat(artifactPath);
assert.equal(artifactStats.size, releaseManifest.archiveBytes);

console.log("✓ Phase 12 Release Hardening verification passed");
console.log(`  v${pkg.version} version, lockfile, security metadata, third-party notices and release documentation verified`);
console.log(`  ${distFiles.length} production files · 66 BSB books · ${searchIndex.length} searchable verses`);
console.log(`  ${releaseManifest.artifact} · sha256 ${archiveSha}`);
console.log("  release candidate contains no source maps; first-party shipped code contains no development hosts or unresolved TODO/FIXME/HACK markers");

assert.equal(pkg.dependencies.fflate, "0.8.3");
assert.equal(pkg.devDependencies.fflate, undefined);
assert.equal(lock.packages["node_modules/fflate"].dev, undefined);
