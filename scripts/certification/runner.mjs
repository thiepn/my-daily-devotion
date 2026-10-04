import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { aggregateReports, artifactDigest, browserShards, fileHashes, inventory, validatePartitions, validateReport } from "./evidence.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const cli = "node_modules/@playwright/test/cli.js";
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + "\n");
function node(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Certification command failed: ${args.join(" ")}`);
}
const npm = (name) => {
  assert.ok(process.env.npm_execpath, "Run certification through npm run verify:phase12");
  node([process.env.npm_execpath, "run", name]);
};
function cleanCommit() {
  assert.equal(git("status", "--porcelain"), "", "Commit the reviewable change before certification");
  return git("rev-parse", "HEAD");
}
function list(args = []) {
  const report = execFileSync(process.execPath, [cli, "test", ...args, "--list", "--reporter=json"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return inventory(JSON.parse(report));
}
async function verifyArtifact(build) {
  assert.equal(cleanCommit(), build.sourceCommit, "Build belongs to another commit");
  const hashes = await fileHashes("dist");
  assert.deepEqual(hashes, build.files, "Production artifact changed after build");
  assert.equal(artifactDigest(hashes), build.artifactDigest);
  assert.equal((await readJson("dist/build-info.json")).sourceCommit, build.sourceCommit);
}

export async function buildStage() {
  const sourceCommit = cleanCommit(), startedAt = Date.now();
  await mkdir("verification/build", { recursive: true });
  for (const file of ["verification/unit.json", "verification/browser.json", "verification/visual.json", "verification/build/build.json"]) await rm(file, { force: true });
  node(["scripts/verify-phase0.mjs"]);
  for (const name of ["typecheck", "test:report", "build"]) npm(name);
  for (let phase = 2; phase <= 11; phase += 1) node([`scripts/verify-phase${phase}.mjs`]);
  const browserInventory = list(), visualInventory = list(["--config=playwright.visual.config.ts"]);
  const partitions = Object.fromEntries(browserShards.map(({ id, project, shard }) => [id, list([`--project=${project}`, `--shard=${shard}`])]));
  validatePartitions(browserInventory, partitions);
  const files = await fileHashes("dist");
  const build = { sourceCommit, startedAt, files, artifactDigest: artifactDigest(files), browserInventory, visualInventory, partitions };
  await copyFile("verification/unit.json", "verification/build/unit.json");
  await writeJson("verification/build/build.json", build);
  await verifyArtifact(build);
  console.log(`✓ One production build: ${browserInventory.length} browser cases, ${visualInventory.length} image cases, ${browserShards.length} browser shards`);
  return build;
}

export async function shardStage(id) {
  const build = await readJson("verification/build/build.json");
  await verifyArtifact(build);
  const visual = id === "visual";
  const definition = visual ? { id, project: "visual", shard: "1/1" } : browserShards.find((item) => item.id === id);
  assert.ok(definition, "Unknown certification shard");
  if (visual) assert.equal(process.platform, "win32", "Run image comparisons on Windows");
  const directory = `verification/shards/${id}`;
  await mkdir(directory, { recursive: true });
  await rm(`${directory}/meta.json`, { force: true }); await rm(`${directory}/report.json`, { force: true });
  const args = visual ? ["--config=playwright.visual.config.ts"] : [`--project=${definition.project}`, `--shard=${definition.shard}`];
  node([cli, "test", ...args], { ...process.env, MDD_TEST_REPORT: `${directory}/report.json` });
  await verifyArtifact(build);
  validateReport(await readJson(`${directory}/report.json`), visual ? build.visualInventory : build.partitions[id], build.startedAt);
  await writeJson(`${directory}/meta.json`, { ...definition, sourceCommit: build.sourceCommit, artifactDigest: build.artifactDigest, platform: process.platform });
}

export async function finishStage(local = false) {
  const build = await readJson("verification/build/build.json");
  await verifyArtifact(build);
  await copyFile("verification/build/unit.json", "verification/unit.json");
  if (local) {
    validateReport(await readJson("verification/browser.json"), build.browserInventory, build.startedAt);
    validateReport(await readJson("verification/visual.json"), build.visualInventory, build.startedAt);
  } else {
    const evidence = [];
    for (const directory of await readdir("verification/shards")) {
      const path = join("verification/shards", directory);
      evidence.push({ meta: await readJson(join(path, "meta.json")), report: await readJson(join(path, "report.json")) });
    }
    const reports = aggregateReports(build, evidence);
    await writeJson("verification/browser.json", reports.browser); await writeJson("verification/visual.json", reports.visual);
  }
  process.env.MDD_CERTIFICATION_COMMIT = build.sourceCommit;
  process.env.MDD_CERTIFICATION_STARTED_AT = String(build.startedAt);
  node(["scripts/verify-phase11.mjs"]);
  for (let phase = 1; phase <= 5; phase += 1) node([`scripts/verify-morning-grace-phase${phase}.mjs`]);
  node(["scripts/verify-mobile-first-layout.mjs"]);
  node(["scripts/package-release.mjs"]);
  node(["scripts/release-evidence.mjs"]);
  node(["scripts/verify-phase12.mjs"]);
}

export async function fullStage() {
  assert.equal(process.platform, "win32", "Full local certification includes Windows image baselines; use staged CI on other hosts");
  const build = await buildStage();
  npm("test:ux"); npm("test:visual");
  await verifyArtifact(build); await finishStage(true);
}
