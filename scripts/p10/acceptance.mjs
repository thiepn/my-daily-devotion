import assert from 'node:assert/strict';

// Claims ledger, not a release authorization or independent signoff.
export const P10_GATES = Object.freeze([
  ['exact-main-release-certificate', 'automated', 'Exact main SHA, complete CI and archive'],
  ['p8-independent-visual-approval', 'human', 'Approved visuals and passing new screenshot run'],
  ['p9-provenance-origin-rollback', 'automated', 'Qualified P9 artifact, origin and rollback controls'],
  ['p1-original-origin-migration', 'human', 'Existing-origin v1.2.5 schema 1 to schema 3'],
  ['p1-backup-restore', 'human', 'Encrypted portable v1 off-device backup and fresh-profile restore'],
  ['p1-interrupted-upgrade-tabs', 'human', 'Two-tab upgrade, interruption, storage pressure and reload'],
  ['p2-existing-origin-path', 'human', 'Existing HTTPS site origin/path and IndexedDB continuity'],
  ['rollback-forward-recovery', 'human', 'Safe forward backup restore, not a schema downgrade'],
  ['android-chrome-physical-device', 'human', 'Chrome installed PWA, offline, IME, resume, quota'],
  ['android-samsung-physical-device', 'human', 'Samsung Internet offline, background, storage and IME'],
  ['accessibility-human-acceptance', 'human', 'TalkBack, focus, contrast, 200% text and keyboard'],
  ['privacy-nondisclosure-review', 'human', 'No private journals, prayer text, passwords or keys in evidence'],
  ['operator-merge-authorization', 'human', 'Independent explicit integration authorization'],
  ['operator-deployment-authorization', 'human', 'Separate explicit deploy authorization for main SHA'],
]);

const GATES = new Map(P10_GATES.map(([id, kind]) => [id, kind]));
const SHA = /^[0-9a-f]{40}$/;
const TOP_FIELDS = ['schemaVersion', 'sourceCommit', 'existingSiteUrl', 'candidateSiteUrl', 'gates'];
const GATE_FIELDS = ['id', 'status', 'sourceCommit', 'evidenceUrls', 'reviewer', 'reviewedAt'];
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
function exactFields(obj, fields) {
  assert.ok(isObject(obj), 'Expected JSON object');
  assert.deepEqual(Object.keys(obj).filter(k => !fields.includes(k)), [],
    'Unexpected field(s); raw private data and arbitrary attachments are forbidden');
}
function validatedUrl(raw, label) {
  assert.equal(typeof raw, 'string', label + ' must be a URL string');
  const url = new URL(raw);
  assert.equal(url.protocol, 'https:', label + ' must use HTTPS');
  assert.ok(url.hostname && !url.username && !url.password && !url.hash,
    label + ' must omit credentials and fragments');
  assert.ok(!url.search, label + ' must not contain query strings or bearer tokens');
  return url;
}
export function verifyExistingOrigin(existing, candidate) {
  const oldSite = validatedUrl(existing, 'existingSiteUrl');
  const newSite = validatedUrl(candidate, 'candidateSiteUrl');
  assert.equal(newSite.origin, oldSite.origin, 'Do not silently move an IndexedDB journal across origins');
  assert.equal(newSite.pathname, oldSite.pathname, 'Do not silently change the existing app path/scope');
  return { originMatch: true, pathMatch: true };
}
export function createPendingLedger(sourceCommit, existingSiteUrl, candidateSiteUrl) {
  assert.match(sourceCommit, SHA, 'Exact 40-hex commit SHA required');
  verifyExistingOrigin(existingSiteUrl, candidateSiteUrl);
  return { schemaVersion: 1, sourceCommit, existingSiteUrl, candidateSiteUrl,
    gates: P10_GATES.map(([id]) => ({ id, status: 'pending', sourceCommit, evidenceUrls: [] })) };
}
export function assessAcceptance(ledger, expectedCommit) {
  assert.match(expectedCommit, SHA, 'Expected exact 40-hex commit SHA');
  exactFields(ledger, TOP_FIELDS);
  assert.equal(ledger.schemaVersion, 1, 'Unsupported ledger version');
  assert.equal(ledger.sourceCommit, expectedCommit, 'Ledger belongs to another source commit');
  verifyExistingOrigin(ledger.existingSiteUrl, ledger.candidateSiteUrl);
  assert.ok(Array.isArray(ledger.gates), 'Missing gate entries');
  assert.equal(ledger.gates.length, P10_GATES.length, 'Required gates missing or extra');
  const seen = new Set(), pending = [], failed = [], claimedPasses = [];
  for (const gate of ledger.gates) {
    exactFields(gate, GATE_FIELDS);
    assert.ok(GATES.has(gate.id), 'Unknown gate');
    assert.ok(!seen.has(gate.id), 'Duplicated gate');
    seen.add(gate.id);
    assert.equal(gate.sourceCommit, expectedCommit, gate.id + ' is stale or belongs to another SHA');
    assert.ok(['pending', 'passed', 'failed'].includes(gate.status), 'Invalid gate status');
    assert.ok(Array.isArray(gate.evidenceUrls), 'Missing evidenceUrls');
    assert.equal(new Set(gate.evidenceUrls).size, gate.evidenceUrls.length, 'Duplicate evidence');
    gate.evidenceUrls.forEach((url, index) => validatedUrl(url, gate.id + '.evidenceUrls[' + index + ']'));
    if (gate.status === 'passed') {
      assert.ok(gate.evidenceUrls.length > 0, 'Claimed pass without evidence: ' + gate.id);
      if (GATES.get(gate.id) === 'human') {
        assert.ok(typeof gate.reviewer === 'string' && /^[a-zA-Z0-9_.-]{2,80}$/.test(gate.reviewer), 'Missing review identity: ' + gate.id);
        assert.ok(typeof gate.reviewedAt === 'string' && !Number.isNaN(Date.parse(gate.reviewedAt)) &&
          /(?:Z|[+-]\d\d:\d\d)$/.test(gate.reviewedAt), 'Missing review timestamp: ' + gate.id);
      }
      claimedPasses.push(gate.id);
    } else if (gate.status === 'failed') failed.push(gate.id);
    else pending.push(gate.id);
  }
  assert.equal(seen.size, GATES.size);
  // No reviewer identities or evidence URLs are printed; claims are never trusted attestation.
  return {
    schemaVersion: 1, sourceCommit: ledger.sourceCommit, totalGates: P10_GATES.length,
    pending, failed, claimedPasses, evidenceComplete: pending.length === 0 && failed.length === 0,
    independentlyVerified: false, releaseAuthorized: false,
    message: 'Self-reported evidence is not an independent review, certification, merger or deployment authorization.',
  };
}
