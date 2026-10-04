import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { aggregateReports, artifactDigest, browserShards, digest, inventory, validatePartitions, validateReport } from "./certification/evidence.mjs";
import { validateCertificationRun, verifyArchive } from "./certification/deployment.mjs";

const startedAt = Date.parse("2026-10-04T08:00:00Z");
function report(project, title = project) {
  return {
    config: { rootDir: "/repo/tests/ux", projects: [{ name: project }] },
    suites: [{ title: "flow.spec.ts", specs: [{ title, file: "flow.spec.ts", line: 5, column: 1, tests: [{ projectName: project, expectedStatus: "passed", status: "expected", results: [{ status: "passed", retry: 0, errors: [], startTime: "2026-10-04T08:01:00Z" }] }] }] }],
    errors: [], stats: { startTime: "2026-10-04T08:01:00Z", duration: 1000, expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
  };
}
function bundle() {
  const evidence = browserShards.map((definition) => ({ meta: { ...definition, sourceCommit: "abc", artifactDigest: "digest", platform: "linux" }, report: report(definition.project, definition.id) }));
  evidence.push({ meta: { id: "visual", project: "visual", shard: "1/1", sourceCommit: "abc", artifactDigest: "digest", platform: "win32" }, report: report("visual") });
  const partitions = Object.fromEntries(evidence.slice(0, -1).map(({ meta, report }) => [meta.id, inventory(report)]));
  return { build: { sourceCommit: "abc", artifactDigest: "digest", startedAt, partitions, browserInventory: Object.values(partitions).flat().sort(), visualInventory: inventory(evidence.at(-1).report) }, evidence };
}

describe("exact certification evidence", () => {
  it("aggregates every engine and image suite exactly once", () => {
    const { build, evidence } = bundle(); const result = aggregateReports(build, evidence);
    expect(result.browser.stats.expected).toBe(browserShards.length);
    expect(result.browser.config.projects.map((item) => item.name)).toContain("offline-pwa");
    expect(result.visual.stats.expected).toBe(1);
  });
  it("normalizes OS-specific absolute paths", () => {
    const linux = report("project"), windows = structuredClone(linux);
    windows.config.rootDir = "C:\\repo\\tests\\ux"; windows.suites[0].specs[0].file = "C:\\repo\\tests\\ux\\flow.spec.ts";
    expect(inventory(windows)).toEqual(inventory(linux));
  });
  it("rejects partition omissions and duplicates", () => {
    expect(() => validatePartitions(["a", "b"], { first: ["a"] })).toThrow();
    expect(() => validatePartitions(["a", "b"], { first: ["a", "a", "b"] })).toThrow();
  });
  it("rejects missing shard evidence", () => {
    const { build, evidence } = bundle(); expect(() => aggregateReports(build, evidence.slice(1))).toThrow();
  });
  it("rejects duplicate shards even with the right total", () => {
    const { build, evidence } = bundle(); evidence[1] = evidence[0]; expect(() => aggregateReports(build, evidence)).toThrow();
  });
  it.each(["sourceCommit", "artifactDigest", "project", "shard"])("rejects wrong %s", (key) => {
    const { build, evidence } = bundle(); evidence[0].meta[key] = "wrong"; expect(() => aggregateReports(build, evidence)).toThrow();
  });
  it("rejects image evidence from a different OS", () => {
    const { build, evidence } = bundle(); evidence.at(-1).meta.platform = "linux"; expect(() => aggregateReports(build, evidence)).toThrow();
  });
  it.each(["unexpected", "flaky", "skipped"])("rejects %s results", (key) => {
    const r = report("project"); r.stats[key] = 1; expect(() => validateReport(r, inventory(r), startedAt)).toThrow();
  });
  it("rejects stale runner and individual evidence", () => {
    const r = report("project"); r.stats.startTime = "2026-10-03T08:00:00Z";
    expect(() => validateReport(r, inventory(r), startedAt)).toThrow();
    r.stats.startTime = "2026-10-04T08:01:00Z"; r.suites[0].specs[0].tests[0].results[0].startTime = "2026-10-03T08:00:00Z";
    expect(() => validateReport(r, inventory(r), startedAt)).toThrow();
  });
  it("rejects successful retries and fabricated report totals", () => {
    const r = report("project"); r.suites[0].specs[0].tests[0].results[0].retry = 1;
    expect(() => validateReport(r, inventory(r), startedAt)).toThrow();
    r.suites[0].specs[0].tests[0].results[0].retry = 0; r.stats.expected = 2;
    expect(() => validateReport(r, inventory(r), startedAt)).toThrow();
  });
  it("hashes assets independently of object insertion order", () => {
    expect(artifactDigest({ a: "1", b: "2" })).toBe(artifactDigest({ b: "2", a: "1" }));
    expect(artifactDigest({ a: "1", b: "2" })).not.toBe(artifactDigest({ a: "1", b: "changed" }));
  });
});

describe("manual deployment", () => {
  const run = { name: "Release Certification CI", path: ".github/workflows/ci.yml", status: "completed", conclusion: "success", head_branch: "main", event: "push", head_sha: "abc" };
  it("accepts only a completed successful certification for the selected main commit", () => {
    expect(() => validateCertificationRun(run, "abc")).not.toThrow();
    expect(() => validateCertificationRun(run, "another-commit")).toThrow();
  });
  it.each([{ conclusion: "cancelled" }, { status: "in_progress" }, { event: "pull_request" }, { head_branch: "feature" }, { path: "other.yml" }])("rejects an ineligible run %j", (change) => {
    expect(() => validateCertificationRun({ ...run, ...change }, "abc")).toThrow();
  });
  function archiveFixture() {
    const bytes = new TextEncoder().encode(JSON.stringify({ sourceCommit: "abc", version: "1.3.0" }));
    const archive = zipSync({ "my-daily-devotion/build-info.json": bytes });
    const manifest = { sha256: digest(archive), sourceCommit: "abc", version: "1.3.0", fileCount: 1 };
    const hashes = { "build-info.json": digest(bytes) };
    const stats = { expected: 1, unexpected: 0, flaky: 0, skipped: 0 };
    const summary = { sourceCommit: "abc", version: "1.3.0", packageSha256: manifest.sha256, unit: { passed: 1, failed: 0, skipped: 0 }, browser: stats, visual: stats };
    return { archive, manifest, hashes, summary };
  }
  it("reopens and checks the exact certified package", () => {
    const f = archiveFixture(); expect(Object.keys(verifyArchive(f.archive, f.manifest, f.hashes, f.summary))).toEqual(["build-info.json"]);
  });
  it("rejects corruption and altered files", () => {
    const f = archiveFixture(); expect(() => verifyArchive(new Uint8Array([1]), f.manifest, f.hashes, f.summary)).toThrow();
    f.hashes["build-info.json"] = "wrong"; expect(() => verifyArchive(f.archive, f.manifest, f.hashes, f.summary)).toThrow();
  });
  it("rejects path traversal even when archive and file hashes agree", () => {
    const f = archiveFixture(); const bytes = new Uint8Array([1]);
    const archive = zipSync({ "my-daily-devotion/../outside": bytes });
    f.manifest.sha256 = digest(archive); f.summary.packageSha256 = f.manifest.sha256;
    expect(() => verifyArchive(archive, f.manifest, { "../outside": digest(bytes) }, f.summary)).toThrow(/Unsafe/);
  });
  it("rejects publication evidence missing successful images", () => {
    const f = archiveFixture(); delete f.summary.visual; expect(() => verifyArchive(f.archive, f.manifest, f.hashes, f.summary)).toThrow();
  });
});
