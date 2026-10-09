import assert from 'node:assert/strict';
import { digest, artifactDigest } from '../certification/evidence.mjs';
import { validateCertificationRun, verifyArchive } from '../certification/deployment.mjs';
import { assessHandoff } from '../p11/handoff.mjs';

const SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
function object(value, name) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), name + ' must be an object');
}
function exactFields(value, fields, name) {
  object(value, name);
  assert.deepEqual(Object.keys(value).filter(key => !fields.includes(key)), [], name + ' contains unrecognized fields');
}
function assertPath(path) {
  assert.ok(typeof path === 'string' && path.length > 0 && path.length <= 250 &&
    !path.startsWith('/') && !/[\\%?#:]/.test(path) && !path.includes('//') &&
    path.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe release asset path');
}
function validateHashInventory(files, expectedCount) {
  object(files, 'Deployment hashes');
  assert.ok(Number.isSafeInteger(expectedCount) && expectedCount > 0, 'Invalid expected count');
  assert.equal(Object.keys(files).length, expectedCount, 'Missing or extra release files');
  assert.ok(Object.hasOwn(files, 'index.html'), 'Missing index.html');
  assert.ok(Object.hasOwn(files, 'build-info.json'), 'Missing build-info.json');
  for (const [path, hash] of Object.entries(files)) {
    assertPath(path);
    assert.equal(typeof hash, 'string', 'Invalid hash');
    assert.match(hash, SHA256, 'Invalid asset SHA256');
  }
}
function compareFileMaps(a, b) {
  object(a, 'Build file inventory');
  object(b, 'Release file inventory');
  assert.deepEqual(Object.entries(a).sort(([x],[y]) => x.localeCompare(y)),
    Object.entries(b).sort(([x],[y]) => x.localeCompare(y)),
    'Build-tested assets and packaged assets do not match');
}
function bindAcceptance(handoff, expectedSha, manifest, hashes) {
  if (handoff === null) return { supplied: false, allClaimsPresent: false, releaseAuthorized: false };
  const status = assessHandoff(handoff, expectedSha);
  // Handoff's shape is a separate P11 envelope. Match actual certified bytes,
  // never its bare self-reported digest or an arbitrary extra inventory.
  assert.ok(handoff.manifest, 'Handoff manifest claim is absent');
  assert.equal(handoff.manifest.sha256, manifest.sha256, 'Handoff archive differs from actual archive');
  assert.equal(handoff.manifest.version, manifest.version, 'Handoff version differs from tested release');
  assert.equal(handoff.manifest.databaseSchemaVersion, manifest.databaseSchemaVersion, 'Handoff schema differs');
  compareFileMaps(handoff.manifest.files, hashes);
  return { supplied: true, allClaimsPresent: status.missing.length === 0, releaseAuthorized: false };
}

/**
 * Verify bytes from an OFFLINE candidate evidence directory. Run metadata and human
 * review are untrusted claims; this function never issues an approval or network request.
 *
 * All caller-provided JSON must be from explicit certification files, not journal data.
 */
export function inspectCandidate({
  expectedSha, releaseManifest, deploymentHashes, verificationSummary,
  buildEvidence, releaseArchive, certificationRun = null, p11Handoff = null,
}) {
  assert.equal(typeof expectedSha, 'string');
  assert.match(expectedSha, SHA, 'Expected exact source commit SHA');
  object(releaseManifest, 'Release manifest');
  object(verificationSummary, 'Verification summary');
  object(buildEvidence, 'Build evidence');
  assert.ok(releaseArchive instanceof Uint8Array, 'Release archive must be bytes');
  assert.equal(releaseManifest.sourceCommit, expectedSha, 'Release manifest SHA mismatch');
  assert.equal(buildEvidence.sourceCommit, expectedSha, 'Tested build source SHA mismatch');
  assert.equal(verificationSummary.sourceCommit, expectedSha, 'Verification summary SHA mismatch');
  assert.equal(verificationSummary.version, releaseManifest.version, 'Release version mismatch');
  assert.equal(verificationSummary.databaseSchema, releaseManifest.databaseSchemaVersion, 'Database schema mismatch');
  assert.ok(releaseManifest.databaseSchemaVersion >= 3, 'Never silently downgrade a schema-3 journal');
  assert.match(releaseManifest.sha256, SHA256, 'Invalid release archive digest');
  assert.equal(releaseManifest.artifact, 'my-daily-devotion-' + releaseManifest.version + '-web.zip',
    'Unexpected artifact identity');
  assert.equal(releaseManifest.archiveBytes, releaseArchive.byteLength, 'Archive length mismatch');
  assert.equal(digest(releaseArchive), releaseManifest.sha256, 'Downloaded archive is not the tested release');
  validateHashInventory(deploymentHashes, releaseManifest.fileCount);
  compareFileMaps(buildEvidence.files, deploymentHashes);
  assert.equal(buildEvidence.artifactDigest, artifactDigest(deploymentHashes),
    'Build provenance digest does not match the file inventory');
  assert.equal(verificationSummary.artifactDigest, buildEvidence.artifactDigest,
    'Certification summary refers to another build');
  assert.equal(verificationSummary.packageSha256, releaseManifest.sha256,
    'Certification summary refers to another archive');
  assert.equal(verificationSummary.deploymentFileCount, releaseManifest.fileCount,
    'Certification summary file count mismatch');
  const files = verifyArchive(releaseArchive, releaseManifest, deploymentHashes, verificationSummary);
  const unpackedBytes = Object.values(files).reduce((sum, bytes) => sum + bytes.byteLength, 0);
  assert.equal(releaseManifest.unpackedBytes, unpackedBytes, 'Unpacked archive byte length mismatch');

  if (certificationRun !== null) {
    // This is still supplied metadata. It must independently be corroborated via
    // GitHub's API by an authorized operator before actual production operations.
    validateCertificationRun(certificationRun, expectedSha);
  }
  const acceptance = bindAcceptance(p11Handoff, expectedSha, releaseManifest, deploymentHashes);
  return {
    sourceCommit: expectedSha,
    version: releaseManifest.version,
    fileCount: releaseManifest.fileCount,
    archiveSha256: releaseManifest.sha256,
    localArtifactHashesVerified: true,
    certificationClaimPresent: certificationRun !== null,
    handoffClaimsPresent: acceptance.supplied,
    handoffClaimsComplete: acceptance.allClaimsPresent,
    independentlyVerifiedReleaseCertification: false,
    humanAcceptanceVerified: false,
    releaseAuthorized: false,
    deploymentPerformed: false,
    nextActions: [
      'Independently verify exact-main CI and artifact IDs against GitHub API',
      'Resolve P8 visual approval and qualify P9-P11 exact heads',
      'Collect P1/P2 original-origin migration and encrypted-backup recovery',
      'Collect physical Android, accessibility and independent operator approvals',
    ],
  };
}
