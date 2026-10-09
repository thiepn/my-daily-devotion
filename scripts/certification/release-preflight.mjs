import assert from "node:assert/strict";

/** An existing journal is scoped to its scheme, host and port, not its URL path. */
export function normalizeReleaseUrl(raw, label) {
  assert.equal(typeof raw, "string", label + " must be a URL string");
  assert.ok(raw.length > 0 && raw.length < 2048, label + " is missing or too long");
  const url = new URL(raw);
  assert.equal(url.protocol, "https:", label + " must use HTTPS");
  assert.ok(url.hostname && !url.username && !url.password, label + " cannot include credentials");
  assert.ok(!url.search && !url.hash, label + " cannot include a query or fragment");
  assert.ok(!url.port || url.port === "443", label + " must use the standard HTTPS port");
  assert.ok(!url.pathname.includes("%") && !url.pathname.includes("\\"), label + " has an unsupported path");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

export const REQUIRED_MIGRATION_ATTESTATION = "P1-UPGRADE-AND-BACKUP-VERIFIED";

/**
 * This is a fail-closed operator gate, not a substitute for the evidence itself.
 * The P1 report must be independently reviewed before its acknowledgement is entered.
 */
export function checkReleasePreflight({ configuredSite, expectedSite, migrationAttestation }) {
  const expectedUrl = normalizeReleaseUrl(expectedSite, "Expected existing site");
  const configuredUrl = normalizeReleaseUrl(configuredSite, "Configured GitHub Pages site");
  assert.equal(configuredUrl, expectedUrl,
    "GitHub Pages points to a different site. Stop: origin/path migration requires a separate data-transfer release.");
  assert.equal(migrationAttestation, REQUIRED_MIGRATION_ATTESTATION,
    "P1 real-profile migration, off-device backup and restore rehearsal are not acknowledged; release blocked.");
  return { expectedUrl, configuredUrl, migrationGate: "operator-attested" };
}
