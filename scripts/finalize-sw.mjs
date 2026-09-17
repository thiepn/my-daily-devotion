import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const manifest = await readFile("dist/.vite/manifest.json");
const html = await readFile("dist/index.html");
const source = await readFile("public/sw.js", "utf8");
const identity = createHash("sha256").update(manifest).update(html).update(source).digest("hex").slice(0, 20);
await writeFile("dist/sw.js", source.replace('BUILD_ID = "development"', `BUILD_ID = "${identity}"`));
console.log(`✓ Offline cache isolated for build ${identity}`);

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
await writeFile(new URL("../dist/build-info.json", import.meta.url), JSON.stringify({ version: pkg.version, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() }) + "\n");
