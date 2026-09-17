import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const base = new URL(process.argv[2]);
// GitHub Pages can report an HTTP custom-domain URL; only verify the secure origin.
if (base.protocol === "http:") base.protocol = "https:";
assert.equal(base.protocol, "https:", "Production verification requires HTTPS");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const manifest = JSON.parse(await readFile("release/release-manifest.json", "utf8"));
const hashes = JSON.parse(await readFile("release/deployment-hashes.json", "utf8"));
async function bytes(path) {
  const response = await fetch(new URL(path, base), { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  assert.equal(new URL(response.url).protocol, "https:", `Insecure redirect while verifying ${path}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
let lastError;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const info = JSON.parse(new TextDecoder().decode(await bytes("build-info.json")));
    assert.equal(info.version, manifest.version); assert.equal(info.sourceCommit, manifest.sourceCommit);
    lastError = null; break;
  } catch (error) { lastError = error; if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 5000)); }
}
if (lastError) throw lastError;
const files = Object.entries(hashes);
for (let i = 0; i < files.length; i += 4) await Promise.all(files.slice(i, i + 4).map(async ([path, sha256]) => {
  assert.equal(createHash("sha256").update(await bytes(path)).digest("hex"), sha256, `Deployment differs from tested artifact: ${path}`);
}));
await writeFile("release/deployment-verification.json", JSON.stringify({ sourceCommit: manifest.sourceCommit, version: manifest.version, url: base.href, verifiedFiles: files.length, verifiedAt: new Date().toISOString() }, null, 2) + "\n");
console.log(`✓ Live deployment matches ${manifest.version} at ${manifest.sourceCommit}: all ${files.length} production files verified`);
