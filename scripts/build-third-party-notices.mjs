import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const lock = JSON.parse(await readFile(join(ROOT, "package-lock.json"), "utf8"));
const source = JSON.parse(await readFile(join(ROOT, "canonical/bsb/source-manifest.json"), "utf8"));
const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING"];
const sections = [];

for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
  if (!packagePath.startsWith("node_modules/") || metadata.dev === true || metadata.optional === true) continue;
  const packageName = packagePath.slice("node_modules/".length);
  let licensePath = null;
  for (const candidate of candidates) {
    const current = join(ROOT, packagePath, candidate);
    try { await access(current); licensePath = current; break; } catch {}
  }
  if (!licensePath) throw new Error(`Production dependency ${packageName}@${metadata.version} has no discoverable license file.`);
  const licenseText = (await readFile(licensePath, "utf8")).trim();
  sections.push({ packageName, version: metadata.version, license: metadata.license ?? "unspecified", licenseText });
}

sections.sort((a, b) => a.packageName.localeCompare(b.packageName));
const output = [
  "MY DAILY DEVOTION — THIRD-PARTY NOTICES",
  "",
  "This file is generated from the committed production dependency graph.",
  "It is included in the release package so redistributed runtime libraries retain their license notices.",
  "",
  `Berean Standard Bible (BSB): public domain effective ${source.license.effectiveDate}, as recorded in canonical/bsb/source-manifest.json.`,
  "",
  ...sections.flatMap((item) => [
    "================================================================================",
    `${item.packageName} ${item.version} — ${item.license}`,
    "================================================================================",
    item.licenseText,
    "",
  ]),
].join("\n");

await mkdir(join(ROOT, "public"), { recursive: true });
await writeFile(join(ROOT, "public", "THIRD_PARTY_NOTICES.txt"), `${output.trimEnd()}\n`, "utf8");
console.log(`✓ Generated third-party notices for ${sections.length} production packages + BSB`);
