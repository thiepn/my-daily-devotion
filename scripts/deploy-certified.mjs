import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { stageCertifiedSite, validateCertificationRun } from "./certification/deployment.mjs";

assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Manual deployment must select main");
assert.ok(process.env.GITHUB_SHA);
const stage = process.argv[2];
if (stage === "validate") {
  const runId = process.argv[3]; assert.match(runId, /^\d+$/, "Invalid certification run ID");
  const run = JSON.parse(execFileSync("gh", ["api", `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`], { encoding: "utf8" }));
  validateCertificationRun(run, process.env.GITHUB_SHA);
  await mkdir("verification", { recursive: true });
  await writeFile("verification/deployment-run.json", JSON.stringify({ runId, sourceCommit: run.head_sha, certificationUrl: run.html_url }, null, 2) + "\n");
} else if (stage === "stage") await stageCertifiedSite(process.env.GITHUB_SHA);
else throw new Error("Unknown manual deployment stage");
