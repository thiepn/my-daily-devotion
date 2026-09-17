import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const manifest = await readFile("dist/.vite/manifest.json");
const html = await readFile("dist/index.html");
const source = await readFile("public/sw.js", "utf8");
const identity = createHash("sha256").update(manifest).update(html).update(source).digest("hex").slice(0, 20);
await writeFile("dist/sw.js", source.replace('BUILD_ID = "development"', `BUILD_ID = "${identity}"`));
console.log(`✓ Offline cache isolated for build ${identity}`);
