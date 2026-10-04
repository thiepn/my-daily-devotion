import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const browserShards = [
  { id: "chromium-1", project: "desktop-chromium", browser: "chromium", shard: "1/3" },
  { id: "chromium-2", project: "desktop-chromium", browser: "chromium", shard: "2/3" },
  { id: "chromium-3", project: "desktop-chromium", browser: "chromium", shard: "3/3" },
  { id: "mobile-1", project: "mobile-chromium", browser: "chromium", shard: "1/2" },
  { id: "mobile-2", project: "mobile-chromium", browser: "chromium", shard: "2/2" },
  { id: "firefox", project: "desktop-firefox", browser: "firefox", shard: "1/1" },
  { id: "webkit", project: "desktop-webkit", browser: "webkit", shard: "1/1" },
  { id: "offline", project: "offline-pwa", browser: "chromium", shard: "1/1" },
];

export const digest = (value) => createHash("sha256").update(value).digest("hex");

export async function fileHashes(directory) {
  const hashes = {};
  async function collect(path, prefix = "") {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      assert.ok(!entry.isSymbolicLink(), "Certified assets must not contain symlinks");
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await collect(join(path, entry.name), `${relative}/`);
      else if (entry.isFile()) hashes[relative] = digest(await readFile(join(path, entry.name)));
    }
  }
  await collect(directory);
  return hashes;
}

export const artifactDigest = (hashes) => digest(JSON.stringify(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b))));

/** Logical identities survive Linux/Windows paths and separate Playwright jobs. */
export function testEntries(report) {
  const entries = [];
  function visit(suites, parents = []) {
    for (const suite of suites ?? []) {
      const titles = [...parents, suite.title.replaceAll("\\", "/")];
      for (const spec of suite.specs ?? []) {
        let file = spec.file.replaceAll("\\", "/");
        const root = report.config.rootDir.replaceAll("\\", "/").replace(/\/$/, "");
        if (file.startsWith(`${root}/`)) file = file.slice(root.length + 1);
        for (const test of spec.tests ?? []) entries.push({ key: JSON.stringify([test.projectName, file, spec.line, spec.column, ...titles, spec.title]), test });
      }
      visit(suite.suites, titles);
    }
  }
  visit(report.suites);
  return entries;
}

export function inventory(report) {
  const keys = testEntries(report).map(({ key }) => key).sort();
  assert.ok(keys.length > 0, "Empty test inventory");
  assert.equal(new Set(keys).size, keys.length, "Duplicate tests in inventory");
  return keys;
}

export function validateReport(report, expected, startedAt) {
  assert.ok(Number.isFinite(startedAt) && startedAt > 0, "Missing certification start");
  assert.ok(Date.parse(report.stats.startTime) >= startedAt, "Stale test report");
  assert.equal((report.errors ?? []).length, 0, "Runner errors must be zero");
  for (const name of ["unexpected", "flaky", "skipped"]) assert.equal(report.stats[name], 0, `Browser ${name} must be zero`);
  const entries = testEntries(report);
  assert.deepEqual(entries.map(({ key }) => key).sort(), expected, "Missing, duplicate, or unexpected tests");
  assert.equal(report.stats.expected, entries.length, "Report totals differ from executed tests");
  for (const { key, test } of entries) {
    assert.equal(test.expectedStatus, "passed", `Nonpassing expectation: ${key}`);
    assert.equal(test.status, "expected", `Nonpassing test: ${key}`);
    assert.equal(test.results.length, 1, `Retried or unexecuted test: ${key}`);
    assert.equal(test.results[0].status, "passed", `Failed test: ${key}`);
    assert.equal(test.results[0].retry, 0, `Retried test: ${key}`);
    assert.equal((test.results[0].errors ?? []).length, 0, `Test errors: ${key}`);
    assert.ok(Date.parse(test.results[0].startTime) >= startedAt, `Stale individual result: ${key}`);
  }
}

export function validatePartitions(all, partitions) {
  assert.deepEqual(Object.values(partitions).flat().sort(), all, "Shard inventories do not cover the entire suite exactly once");
}

export function aggregateReports(build, evidence) {
  assert.equal(evidence.length, browserShards.length + 1, "Missing or extra shard evidence");
  const seen = new Set(), browser = [];
  let visual;
  for (const { meta, report } of evidence) {
    assert.ok(!seen.has(meta.id), "Duplicate shard evidence"); seen.add(meta.id);
    assert.equal(meta.sourceCommit, build.sourceCommit, "Evidence belongs to another commit");
    assert.equal(meta.artifactDigest, build.artifactDigest, "Evidence tested another artifact");
    const definition = meta.id === "visual" ? { id: "visual", project: "visual", shard: "1/1" } : browserShards.find((item) => item.id === meta.id);
    assert.ok(definition, "Unknown shard");
    assert.equal(meta.project, definition.project); assert.equal(meta.shard, definition.shard);
    validateReport(report, meta.id === "visual" ? build.visualInventory : build.partitions[meta.id], build.startedAt);
    if (meta.id === "visual") { assert.equal(meta.platform, "win32", "Visual evidence requires Windows rasterization"); visual = report; }
    else browser.push(report);
  }
  assert.ok(visual, "Missing visual evidence");
  const projects = new Map(browser.flatMap((report) => report.config.projects).map((project) => [project.name, project]));
  const stats = {
    startTime: new Date(Math.min(...browser.map((report) => Date.parse(report.stats.startTime)))).toISOString(),
    duration: Math.max(...browser.map((report) => Date.parse(report.stats.startTime) + report.stats.duration)) - Math.min(...browser.map((report) => Date.parse(report.stats.startTime))),
    expected: browser.reduce((sum, report) => sum + report.stats.expected, 0), unexpected: 0, flaky: 0, skipped: 0,
  };
  const combined = { config: { ...browser[0].config, projects: [...projects.values()], shard: null }, suites: browser.flatMap((report) => report.suites), errors: [], stats };
  validateReport(combined, build.browserInventory, build.startedAt);
  return { browser: combined, visual };
}
