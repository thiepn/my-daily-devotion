import assert from 'node:assert/strict';
import { inspectReviewerIntake } from '../p13/reviewer.mjs';
import { verifyExistingOrigin } from '../p10/acceptance.mjs';

const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const REQUIREMENTS = Object.freeze({
  'android-chrome': ['offline-cold-start','background-resume','ime-writing','storage-pressure','service-worker-update'],
  'android-samsung-internet': ['offline-cold-start','background-resume','ime-writing','storage-pressure'],
  'android-talkback': ['talkback-navigation','keyboard-focus','text-200','contrast-review'],
});
function exact(v, names) {
  assert.ok(v && typeof v === 'object' && !Array.isArray(v), 'Expected metadata object');
  assert.deepEqual(Object.keys(v).filter(k => !names.includes(k)), [], 'Unknown or personal-data field');
}
function planRecovery(plan, sha) {
  if (plan === null) return {supplied:false,rehearsed:false,actionsPerformed:false};
  exact(plan, ['sourceCommit','existingSiteUrl','candidateSiteUrl','installedSchema',
    'targetSchema','action','destructiveStep','backupFormat','encryptedOffDevice','restoreClaimed','evidenceSha256']);
  assert.equal(plan.sourceCommit, sha, 'Stale recovery source');
  verifyExistingOrigin(plan.existingSiteUrl, plan.candidateSiteUrl);
  assert.ok(Number.isSafeInteger(plan.installedSchema) && plan.installedSchema >= 3);
  assert.ok(Number.isSafeInteger(plan.targetSchema) && plan.targetSchema >= plan.installedSchema,
    'Unsafe database downgrade or incompatible rollback');
  assert.ok(['forward-compatible-fix','fresh-compatible-profile-restore'].includes(plan.action),
    'Disallowed recovery action');
  assert.equal(plan.destructiveStep, false, 'Destructive recovery action forbidden');
  assert.equal(plan.backupFormat, 'portable-v1-encrypted');
  assert.equal(plan.encryptedOffDevice, true, 'Off-device encrypted backup required');
  assert.equal(typeof plan.restoreClaimed, 'boolean');
  assert.match(plan.evidenceSha256, HASH);
  return {supplied:true,claimedRestore:plan.restoreClaimed,rehearsed:false,actionsPerformed:false};
}
function correlate(snapshot, receipts, links, sha) {
  assert.ok(snapshot && snapshot.sourceCommit === sha, 'Stale GitHub review source');
  assert.ok(Array.isArray(snapshot.entries), 'Review source missing');
  assert.ok(Array.isArray(links) && links.length <= 100, 'Invalid receipt/source links');
  const receiptById = new Map(receipts.map(r => [r.receiptId,r]));
  const reviewById = new Map(snapshot.entries.map(r => [r.reviewId,r]));
  assert.equal(reviewById.size,snapshot.entries.length,'Duplicate source reviews');
  const seenReceipts = new Set(), seenReviews = new Set();
  let matched = 0, missingSource = 0, independentCurrentHead = 0;
  for (const link of links) {
    exact(link,['receiptId','reviewId','reviewBodySha256']);
    assert.ok(typeof link.receiptId === 'string');
    assert.ok(Number.isSafeInteger(link.reviewId) && link.reviewId>0);
    assert.match(link.reviewBodySha256,HASH);
    assert.ok(!seenReceipts.has(link.receiptId) && !seenReviews.has(link.reviewId),
      'Duplicate source-linked receipt');
    seenReceipts.add(link.receiptId);seenReviews.add(link.reviewId);
    const receipt=receiptById.get(link.receiptId);
    assert.ok(receipt,'Source link without intake receipt');
    const review=reviewById.get(link.reviewId);
    if(!review){missingSource++;continue;}
    assert.equal(review.bodySha256,link.reviewBodySha256,'Review body digest differs');
    assert.equal(review.reviewerHandle,receipt.reviewerHandle,'Receipt reviewer is not GitHub author');
    assert.equal(review.commitSha,receipt.sourceCommit,'Review belongs to another commit');
    assert.equal(review.submittedAt,receipt.reviewedAt,'Review timestamp differs');
    assert.equal(review.state,receipt.decision==='accept'?'APPROVED':'CHANGES_REQUESTED',
      'Review source state differs from unsigned decision claim');
    matched++;
    if (review.onExpectedHead && review.independentOfKnownCodeAuthors) independentCurrentHead++;
  }
  return {linkedClaims:links.length,matchedSourceRecords:matched,
    missingSourceRecords:missingSource,independentCodeReviewSourcesOnHead:independentCurrentHead,
    specificVisualApprovalVerified:false,sourceReadIndependentOfUser:false};
}
function deviceCoverage(receipts) {
  const result = {};
  for (const [platform, needed] of Object.entries(REQUIREMENTS)) {
    const observed = new Set();
    for (const receipt of receipts) {
      if (receipt.device?.platform===platform && receipt.decision==='accept') {
        receipt.device.scenarios.forEach(s => observed.add(s));
      }
    }
    result[platform]={claimedScenarios:observed.size,
      missingRequiredScenarios:needed.filter(s=>!observed.has(s)),
      physicalDeviceVerified:false};
  }
  return result;
}

/** Strictly a reconciliation of claims. GitHub metadata and paper packet are not
    independent proof that the owner approved a deployment or a device was tested. */
export function reconcileEvidence({
  sourceCommit, receiptPacket, priorReceiptIds, githubReviewSnapshot,
  sourceLinks = [], recoveryPlan = null,
}) {
  assert.match(sourceCommit,SHA,'Exact source SHA required');
  exact(receiptPacket,['sourceCommit','receipts']);
  assert.equal(receiptPacket.sourceCommit,sourceCommit,'Stale receipt packet');
  const intake=inspectReviewerIntake({
    sourceCommit,receipts:receiptPacket.receipts,priorReceiptIds,
  });
  const sources=correlate(githubReviewSnapshot,receiptPacket.receipts,sourceLinks,sourceCommit);
  const devices=deviceCoverage(receiptPacket.receipts);
  const recovery=planRecovery(recoveryPlan,sourceCommit);
  const missing=['p8-independent-visual-approval','p9-qualification',
    'p1-p2-migration-backup-human-review','physical-device-and-accessibility-signoff',
    'distinct-merge-deploy-publication-approvals','exact-main-release-certification'];
  return {sourceCommit,unsignedReceiptClaims:intake.receiptClaims,
    githubSourceLinkClaims:sources.linkedClaims,githubRecordsMatched:sources.matchedSourceRecords,
    missingGithubSourceRecords:sources.missingSourceRecords,
    independentCodeReviewSourceClaims:sources.independentCodeReviewSourcesOnHead,
    deviceScenarioClaims:devices,recoveryClaim:recovery,
    priorReceiptHistoryCryptographicallyAuthenticated:false,
    humanReviewerIdentityVerified:false,physicalDeviceVerified:false,
    visualApprovalVerified:false,operatorApprovalVerified:false,
    releaseAuthorized:false,actionsPerformed:false,missingMandatoryReleaseGates:missing,
    message:'No receipt, GitHub review, device checklist or backup claim authorizes a release.',
  };
}
