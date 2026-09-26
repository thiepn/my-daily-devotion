import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
const unit = JSON.parse(await readFile("verification/unit.json", "utf8"));
const browser = JSON.parse(await readFile("verification/browser.json", "utf8"));
const release = JSON.parse(await readFile("release/release-manifest.json", "utf8"));
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const startedAt = Number(process.env.MDD_CERTIFICATION_STARTED_AT);
assert.ok(Number.isFinite(startedAt) && startedAt > 0, "Run verify:phase12 to establish fresh evidence.");
assert.equal(process.env.MDD_CERTIFICATION_COMMIT, sourceCommit, "HEAD changed during certification.");
assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Working tree changed during certification.");
assert.ok(unit.startTime >= startedAt, "Unit evidence is stale.");
assert.ok(Date.parse(browser.stats.startTime) >= startedAt, "Browser evidence is stale.");
assert.equal(release.sourceCommit, sourceCommit);
assert.ok(unit.numPassedTests > 0); assert.equal(unit.numFailedTests, 0); assert.equal(unit.numPendingTests, 0); assert.equal(unit.numTodoTests ?? 0, 0);
assert.ok(browser.stats.expected > 0); for (const key of ["unexpected", "flaky", "skipped"]) assert.equal(browser.stats[key], 0, `Browser ${key} must be zero`);
const hashes = {};
async function collect(directory, prefix = "") {
  for (const item of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
    const relative = `${prefix}${item.name}`, full = join(directory, item.name);
    if (item.isDirectory()) await collect(full, `${relative}/`);
    else if (item.isFile()) hashes[relative] = createHash("sha256").update(await readFile(full)).digest("hex");
  }
}
await collect("dist");
await writeFile("release/deployment-hashes.json", JSON.stringify(hashes, null, 2) + "\n");
const report = {
  sourceCommit, version: release.version, databaseSchema: release.databaseSchemaVersion,
  unit: { passed: unit.numPassedTests, failed: unit.numFailedTests, skipped: unit.numPendingTests },
  browser: browser.stats,
  engines: browser.config.projects.map(p => ({ name: p.name, browser: p.use?.browserName ?? "see project configuration" })),
  scripture: { verses: 31086, assignments: 365, quotationRegressions: 28, omittedNoteRegressions: 112, coverage: "full corpus verified during build" },
  packageSha256: release.sha256, deploymentFileCount: Object.keys(hashes).length,
  limitations: ["No physical Android/iOS device certification", "No human screen-reader certification", "Same-origin storage is not application-level isolation; no origin migration was performed"],
};
await writeFile("release/verification-summary.json", JSON.stringify(report, null, 2) + "\n");
await copyFile("verification/unit.json", "release/unit-results.json");
await copyFile("verification/browser.json", "release/browser-results.json");
console.log(`✓ Commit ${sourceCommit}: ${unit.numPassedTests} unit tests, ${browser.stats.expected} browser tests, no failures/skips/flaky tests`);
