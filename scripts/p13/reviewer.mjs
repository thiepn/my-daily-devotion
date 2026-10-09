import assert from 'node:assert/strict';
import { P10_GATES } from '../p10/acceptance.mjs';

const SHA = /^[0-9a-f]{40}$/, HASH = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ALLOWED_GATES = new Set(P10_GATES.map(([id])=>id));
const PLATFORM = new Set(['android-chrome','android-samsung-internet','android-talkback','desktop-keyboard','desktop-screen-reader']);
const SCENARIOS = new Set(['offline-cold-start','background-resume','low-memory-resume','ime-writing','storage-pressure','multi-tab-upgrade','service-worker-update','backup-restore','keyboard-focus','talkback-navigation','text-200','contrast-review']);
function exact(o, keys) {
  assert.ok(o && typeof o === 'object' && !Array.isArray(o), 'Evidence must be structured metadata');
  assert.deepEqual(Object.keys(o).filter(k=>!keys.includes(k)), [], 'Unknown or private evidence field');
}
function url(raw) {
  assert.equal(typeof raw,'string'); const u=new URL(raw);
  assert.equal(u.protocol,'https:');
  assert.ok(u.hostname && !u.username && !u.password && !u.search && !u.hash, 'Unsafe evidence URL');
}
/** Previously used receipt IDs must come from an independently trusted immutable registry. */
export function inspectReviewerIntake({sourceCommit, receipts, priorReceiptIds = []}) {
  assert.match(sourceCommit,SHA);
  assert.ok(Array.isArray(receipts) && receipts.length <= 100, 'Too many receipts');
  assert.ok(Array.isArray(priorReceiptIds) && priorReceiptIds.length <= 10000, 'Invalid previous receipt inventory');
  const previous = new Set();
  for(const id of priorReceiptIds){ assert.match(id,UUID); assert.ok(!previous.has(id), 'Duplicate prior receipt'); previous.add(id); }
  const current = new Set(); const claimedDevices = new Set(); let acceptedClaims=0,rejectedClaims=0;
  for(const r of receipts){
    exact(r,['receiptId','sourceCommit','gateId','reviewerHandle','reviewedAt','evidenceUrl','evidenceSha256','decision','device']);
    assert.match(r.receiptId,UUID,'Version-4 random receipt ID required');
    assert.ok(!current.has(r.receiptId) && !previous.has(r.receiptId), 'Duplicate/replayed receipt ID');
    current.add(r.receiptId);
    assert.equal(r.sourceCommit,sourceCommit,'Stale reviewer evidence');
    assert.ok(ALLOWED_GATES.has(r.gateId),'Unknown acceptance gate');
    assert.ok(typeof r.reviewerHandle==='string' && /^[a-zA-Z0-9_.-]{2,80}$/.test(r.reviewerHandle));
    assert.ok(typeof r.reviewedAt==='string' && !Number.isNaN(Date.parse(r.reviewedAt)) &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(r.reviewedAt),'Review timestamp missing');
    assert.ok(r.decision==='accept'||r.decision==='reject','Explicit review decision required');
    url(r.evidenceUrl); assert.match(r.evidenceSha256,HASH,'Evidence digest required');
    if(r.decision==='accept')acceptedClaims++;else rejectedClaims++;
    if(r.device!==undefined){
      exact(r.device,['platform','claimedPhysical','scenarios']);
      assert.ok(PLATFORM.has(r.device.platform),'Unknown device platform');
      assert.equal(r.device.claimedPhysical,true,'Do not mistake emulator evidence for physical acceptance');
      assert.ok(Array.isArray(r.device.scenarios) && r.device.scenarios.length>0);
      assert.ok(r.device.scenarios.every(x=>SCENARIOS.has(x)),'Unknown scenario');
      assert.equal(new Set(r.device.scenarios).size,r.device.scenarios.length,'Duplicated scenarios');
      claimedDevices.add(r.device.platform);
    }
  }
  return {sourceCommit,receiptClaims:receipts.length,acceptedClaims,rejectedClaims,
    claimedPhysicalPlatforms:[...claimedDevices].sort(),duplicateIdsDetected:false,
    historyWasIndependentlyAuthenticated:false,
    identityVerified:false,physicalDeviceVerified:false,
    authenticatedHumanSignoffs:0,releaseAuthorized:false,
    message:'Receipt freshness and claimed physical operation require an independent append-only registry and operator review.'};
}
