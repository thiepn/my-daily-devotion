import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const RELEASE = join(ROOT, "release");
const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const artifactName = `my-daily-devotion-${pkg.version}-web.zip`;
const artifactPath = join(RELEASE, artifactName);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

await stat(join(DIST, "index.html"));
await rm(RELEASE, { recursive: true, force: true });
await mkdir(RELEASE, { recursive: true });

const files = await collectFiles(DIST);
const zipped = {};
let unpackedBytes = 0;
for (const absolute of files) {
  const bytes = await readFile(absolute);
  unpackedBytes += bytes.byteLength;
  const relativePath = relative(DIST, absolute).split(sep).join("/");
  zipped[`my-daily-devotion/${relativePath}`] = new Uint8Array(bytes);
}

const archive = zipSync(zipped, { level: 9 });
await writeFile(artifactPath, archive);
const sha256 = createHash("sha256").update(archive).digest("hex");
const schemaSource = await readFile(join(ROOT, "src/data/schema.ts"), "utf8");
const schemaVersion = Number(/DATABASE_SCHEMA_VERSION\s*=\s*(\d+)/.exec(schemaSource)?.[1] ?? NaN);
if (!Number.isInteger(schemaVersion)) throw new Error("Could not resolve database schema version for release manifest.");

const releaseManifest = {
  product: "My Daily Devotion",
  version: pkg.version,
  artifact: artifactName,
  sha256,
  databaseSchemaVersion: schemaVersion,
  fileCount: files.length,
  unpackedBytes,
  archiveBytes: archive.byteLength,
  sourceCommit: process.env.GITHUB_SHA ?? null,
};
await writeFile(join(RELEASE, "release-manifest.json"), `${JSON.stringify(releaseManifest, null, 2)}\n`);
await writeFile(join(RELEASE, "SHA256SUMS"), `${sha256}  ${artifactName}\n`);

console.log(`✓ Packaged ${artifactName}`);
console.log(`  ${files.length} files · ${Math.round(archive.byteLength / 1024)} KiB · sha256 ${sha256}`);
