import { describe, expect, it } from "vitest";
import { checkReleasePreflight, normalizeReleaseUrl, REQUIRED_MIGRATION_ATTESTATION } from "./certification/release-preflight.mjs";

const existingSite = "https://thiepn.dev/my-daily-devotion/";
const valid = {
  configuredSite: existingSite,
  expectedSite: existingSite,
  migrationAttestation: REQUIRED_MIGRATION_ATTESTATION,
};

describe("P2 certified web release preflight", () => {
  it("requires the configured Pages site and approved existing site to match exactly", () => {
    expect(checkReleasePreflight(valid)).toMatchObject({
      expectedUrl: existingSite, configuredUrl: existingSite, migrationGate: "operator-attested",
    });
    expect(checkReleasePreflight({ ...valid, expectedSite: "https://thiepn.dev/my-daily-devotion" }).expectedUrl).toBe(existingSite);
  });

  it.each([
    "https://mdd.thiepn.dev/",
    "https://thiepn.github.io/my-daily-devotion/",
    "https://thiepn.dev/",
    "https://thiepn.dev/library/",
  ])("blocks an unapproved origin or path %s", site => {
    expect(() => checkReleasePreflight({ ...valid, configuredSite: site })).toThrow(/different site/i);
  });

  it("rejects absent or inaccurate migration attestations", () => {
    for (const migrationAttestation of ["", "yes", "P1-VERIFIED", "P1-UPGRADE-VERIFIED"]) {
      expect(() => checkReleasePreflight({ ...valid, migrationAttestation })).toThrow(/release blocked/i);
    }
  });

  it.each([
    "http://thiepn.dev/my-daily-devotion/",
    "https://user:pass@thiepn.dev/my-daily-devotion/",
    "https://thiepn.dev/my-daily-devotion/?redirect=1",
    "https://thiepn.dev/my-daily-devotion/#today",
    "https://thiepn.dev/%2e%2e/my-daily-devotion/",
    "not-a-url",
  ])("rejects unsafe destination %s", destination => {
    expect(() => normalizeReleaseUrl(destination, "Destination")).toThrow();
  });
});
