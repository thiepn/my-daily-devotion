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
for (const name of ["typecheck", "test", "build"]) npm(name);
for (let phase = 2; phase <= 10; phase += 1) node([`scripts/verify-phase${phase}.mjs`]);
npm("test:ux");
node(["scripts/verify-phase11.mjs"]);
npm("release:package");
node(["scripts/verify-phase12.mjs"]);
