import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const INPUT = join(ROOT, "canonical/mcheyne/plan.v1.json");
const OUTPUT_DIR = join(ROOT, "public/plans");
const OUTPUT = join(OUTPUT_DIR, "mcheyne-classic.v1.json");

export async function buildMcheyneAsset() {
  const plan = JSON.parse(await readFile(INPUT, "utf8"));
  assert.equal(plan.planId, "mcheyne-classic");
  assert.equal(plan.version, 1);
  assert.equal(plan.assignments.length, 365);
  assert.equal(new Set(plan.assignments.map((item) => item.calendarKey)).size, 365);
  assert.ok(!plan.assignments.some((item) => item.calendarKey === "02-29"));
  for (let index = 0; index < plan.assignments.length; index += 1) {
    const assignment = plan.assignments[index];
    assert.equal(assignment.sequence, index + 1);
    assert.equal(assignment.readings.length, 4);
    assert.deepEqual(assignment.readings.map((reading) => reading.group), ["family", "family", "secret", "secret"]);
    for (const reading of assignment.readings) assert.ok(Array.isArray(reading.references) && reading.references.length >= 1);
  }
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(plan), "utf8");
  console.log("✓ Built M'Cheyne runtime asset: 365 assignments");
}

buildMcheyneAsset().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
