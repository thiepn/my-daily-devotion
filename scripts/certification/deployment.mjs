import assert from "node:assert/strict";
import { readFile, mkdir, readdir, writeFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { unzipSync } from "fflate";
import { digest } from "./evidence.mjs";

export function validateCertificationRun(run, sourceCommit) {
  assert.equal(run.status, "completed", "Certification has not completed");
  assert.equal(run.conclusion, "success", "Certification did not pass");
  assert.equal(run.name, "Release Certification CI");
  assert.equal(run.path, ".github/workflows/ci.yml");
  assert.equal(run.head_branch, "main", "Deploy only a certified main commit");
  assert.ok(["push", "workflow_dispatch"].includes(run.event), "PR artifacts cannot be deployed");
  assert.equal(run.head_sha, sourceCommit, "Certification is not for the selected main commit");
}

export function verifyArchive(archive, manifest, hashes, summary) {
  assert.equal(digest(archive), manifest.sha256, "Certified archive checksum mismatch");
  assert.equal(summary.sourceCommit, manifest.sourceCommit);
  assert.equal(summary.version, manifest.version);
  assert.equal(summary.packageSha256, manifest.sha256);
  assert.ok(summary.unit.passed > 0); assert.equal(summary.unit.failed, 0); assert.equal(summary.unit.skipped, 0);
  for (const group of [summary.browser, summary.visual]) {
    assert.ok(group.expected > 0);
    for (const key of ["unexpected", "flaky", "skipped"]) assert.equal(group[key], 0);
  }
  const files = unzipSync(new Uint8Array(archive));
  const prefix = "my-daily-devotion/";
  assert.equal(Object.keys(files).length, Object.keys(hashes).length, "Unexpected archive files");
  assert.equal(manifest.fileCount, Object.keys(hashes).length);
  for (const [name, bytes] of Object.entries(files)) {
    assert.ok(name.startsWith(prefix), "Archive has an unexpected root");
    const relative = name.slice(prefix.length);
    assert.ok(relative && !relative.includes("\\") && !relative.includes(":") && relative.split("/").every((part) => part && part !== "." && part !== ".."), "Unsafe archive path");
    assert.equal(digest(bytes), hashes[relative], `Certified file differs: ${relative}`);
  }
  const info = JSON.parse(new TextDecoder().decode(files[`${prefix}build-info.json`]));
  assert.equal(info.sourceCommit, manifest.sourceCommit); assert.equal(info.version, manifest.version);
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name.slice(prefix.length), bytes]));
}

export async function stageCertifiedSite(sourceCommit, destination = "dist") {
  const manifest = JSON.parse(await readFile("release/release-manifest.json", "utf8"));
  assert.equal(manifest.sourceCommit, sourceCommit);
  assert.equal(manifest.version, JSON.parse(await readFile("package.json", "utf8")).version);
  assert.match(manifest.artifact, /^my-daily-devotion-\d+\.\d+\.\d+-web\.zip$/);
  const files = verifyArchive(
    await readFile(join("release", manifest.artifact)), manifest,
    JSON.parse(await readFile("release/deployment-hashes.json", "utf8")),
    JSON.parse(await readFile("release/verification-summary.json", "utf8")),
  );
  const directory = resolve(destination), workspace = resolve(".");
  assert.ok(directory.startsWith(`${workspace}/`) || directory.startsWith(`${workspace}\\`), "Staging must stay in the workspace");
  const existing = await readdir(directory).catch((error) => { if (error.code === "ENOENT") return []; throw error; });
  assert.equal(existing.length, 0, "Refuse to mix certified and existing assets");
  await mkdir(directory, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    const target = join(directory, name);
    await mkdir(resolve(target, ".."), { recursive: true }); await writeFile(target, bytes);
  }
  await copyFile("verification/deployment-run.json", "release/certified-run.json");
}
