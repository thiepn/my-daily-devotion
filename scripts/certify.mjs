import { spawnSync } from "node:child_process";

// Run each gate once. Recursive npm scripts repeatedly prepend PATH entries and
// exceed cmd.exe's environment limit on Windows in deeply nested checkouts.
const node = (args) => {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const npm = (name) => node([process.env.npm_execpath, "run", name]);
node(["scripts/verify-phase0.mjs"]);
for (const name of ["typecheck", "test:report", "build"]) npm(name);
for (let phase = 2; phase <= 10; phase += 1) node([`scripts/verify-phase${phase}.mjs`]);
npm("test:ux");
node(["scripts/verify-phase11.mjs"]);
node(["scripts/verify-morning-grace-phase1.mjs"]);
node(["scripts/verify-morning-grace-phase2.mjs"]);
node(["scripts/verify-morning-grace-phase3.mjs"]);
node(["scripts/verify-morning-grace-phase4.mjs"]);
node(["scripts/verify-morning-grace-phase5.mjs"]);
node(["scripts/verify-mobile-first-layout.mjs"]);
// Package the exact dist tested above: never rebuild after browser acceptance.
node(["scripts/package-release.mjs"]);
node(["scripts/release-evidence.mjs"]);
node(["scripts/verify-phase12.mjs"]);
