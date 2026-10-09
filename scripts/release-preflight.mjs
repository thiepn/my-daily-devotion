import { mkdir, writeFile } from "node:fs/promises";
import { checkReleasePreflight } from "./certification/release-preflight.mjs";

const configuredSite = process.env.MDD_CONFIGURED_PAGES_URL;
const expectedSite = process.env.MDD_EXPECTED_PUBLIC_URL;
const migrationAttestation = process.env.MDD_P1_MIGRATION_ATTESTATION;
const result = checkReleasePreflight({ configuredSite, expectedSite, migrationAttestation });
await mkdir("verification", { recursive: true });
await writeFile("verification/release-preflight.json", JSON.stringify({
  ...result,
  sourceCommit: process.env.GITHUB_SHA,
  githubRunId: process.env.GITHUB_RUN_ID,
  acceptedAt: new Date().toISOString(),
  warning: "Operator acknowledgement is not independent evidence of physical-device or user-data migration tests.",
}, null, 2) + "\n");
console.log("Release preflight accepted for existing Pages site:", result.expectedUrl);
