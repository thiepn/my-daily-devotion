import assert from 'node:assert/strict';
import {verifyExistingOrigin} from '../p10/acceptance.mjs';
import {REQUIRED_VISUAL_DECISIONS} from '../p15/attestations.mjs';
import {verifyReceiptHistory} from '../p16/receipt-history.mjs';
import {inspectOperatorClosure} from '../p16/operator.mjs';
import {strictObject} from '../p16/custody.mjs';
import {inspectWitnessedAnchor} from './witnessed-anchor.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const MIGRATION_FIELDS=['sourceCommit','originalSiteUrl','candidateSiteUrl','schemaBefore',
  'schemaAfter','backupFormat','offDeviceEncrypted','migrationEvidenceSha256',
  'restoreEvidenceSha256','profileKind','claimedRestored'];
const OBJECT_FIELDS=['sourceCommit','kind','subjectId','evidenceSha256','origin',
  'scenarioCount','operatorReviewedClaim'];
const KINDS=['android-device','accessibility'];
const ORIGINS=['synthetic-device-packet','controlled-physical-review-packet'];
/** Audit only. All externally supplied statements remain claims until verified by their operators. */
export function inspectP17Closure({
  sourceCommit,originalSiteUrl,anchor,externalWitnessPins,
  previouslyAcceptedNonceIds=[],minimumAcceptedSequence=0,
  minimumAcceptedRevision=1,rootPublicSpkiDerBase64,
  manifest,records,checkpoint,previouslyUsedNonces=[],codeAuthorHandles=[],
  currentTime,deviceClaims=[],devicePackets=[],migrationPacket,recoveryPlan,
  archiveEvidence,gateClaims,
}) {
  assert.match(sourceCommit,SHA);
  verifyExistingOrigin(originalSiteUrl,originalSiteUrl);
  const witnessed=inspectWitnessedAnchor({
    sourceCommit,anchor,externalWitnessPins,previouslyAcceptedNonceIds,
    minimumAcceptedSequence,minimumAcceptedRevision,currentTime,
  });
  const verified=verifyReceiptHistory({
    sourceCommit,rootPublicSpkiDerBase64,
    expectedRootSha256:witnessed.custodyRootSha256,
    minimumTrustedRevision:witnessed.minimumCustodyRevision,
    manifest,trustedPreviousAnchor:{
      sequence:witnessed.ledgerSequence,digest:witnessed.ledgerDigest,
    },records,checkpoint,previouslyUsedNonces,codeAuthorHandles,currentTime,
  });
  const rehearsal=inspectOperatorClosure({
    sourceCommit,originalSiteUrl,archiveEvidence,verifiedHistory:verified,
    historyRecords:records,deviceClaims,recoveryPlan,gateClaims,
  });
  assert.ok(Array.isArray(devicePackets) && devicePackets.length<=20,'Too many device packets');
  const checkedDevices=new Set(),packetCounts={};
  for(const packet of devicePackets) {
    strictObject(packet,OBJECT_FIELDS);
    assert.equal(packet.sourceCommit,sourceCommit,'Device packet source mismatch');
    assert.ok(KINDS.includes(packet.kind),'Invalid device packet kind');
    assert.ok(ORIGINS.includes(packet.origin),'Unknown device evidence origin');
    assert.match(packet.evidenceSha256,HASH);
    assert.equal(packet.operatorReviewedClaim===true||packet.operatorReviewedClaim===false,true);
    assert.ok(Number.isSafeInteger(packet.scenarioCount) && packet.scenarioCount>0);
    const subject=packet.kind+'/'+packet.subjectId;
    assert.ok(!checkedDevices.has(subject),'Duplicated device packet');
    checkedDevices.add(subject);
    const record=records.find(record => record.receipt.subjectType===packet.kind &&
      record.receipt.subjectId===packet.subjectId && record.receipt.decision==='accept');
    assert.ok(record,'Device packet has no signed attestation');
    assert.equal(record.receipt.evidenceSha256,packet.evidenceSha256,
      'Device packet does not match attested evidence hash');
    const checklist=deviceClaims.find(c=>c.subjectId===packet.subjectId);
    assert.ok(checklist,'Device packet has no scenario checklist');
    assert.equal(packet.scenarioCount,checklist.scenarioIds.length,
      'Device packet scenario count differs from checklist');
    packetCounts[packet.subjectId]=packet.scenarioCount;
  }
  let migration={supplied:false,claimedRestored:false,independentlyVerified:false};
  if(migrationPacket!==null && migrationPacket!==undefined) {
    strictObject(migrationPacket,MIGRATION_FIELDS);
    assert.equal(migrationPacket.sourceCommit,sourceCommit,'Migration packet SHA mismatch');
    verifyExistingOrigin(originalSiteUrl,migrationPacket.originalSiteUrl);
    verifyExistingOrigin(originalSiteUrl,migrationPacket.candidateSiteUrl);
    assert.equal(migrationPacket.schemaBefore,1,'Expected original deployed schema-1 input');
    assert.equal(migrationPacket.schemaAfter,3,'Expected safe schema-3 upgrade target');
    assert.equal(migrationPacket.profileKind,'disposable','Only disposable profiles for migration rehearsal');
    assert.equal(migrationPacket.backupFormat,'portable-v1-encrypted');
    assert.equal(migrationPacket.offDeviceEncrypted,true);
    assert.equal(typeof migrationPacket.claimedRestored,'boolean');
    assert.match(migrationPacket.migrationEvidenceSha256,HASH);
    assert.match(migrationPacket.restoreEvidenceSha256,HASH);
    const claimed=[
      ['original-origin-schema-migration',migrationPacket.migrationEvidenceSha256],
      ['encrypted-off-device-backup-restore',migrationPacket.restoreEvidenceSha256],
    ];
    for(const [id,hash] of claimed) {
      const record=records.find(r=>r.receipt.subjectType==='migration-backup' &&
        r.receipt.subjectId===id && r.receipt.decision==='accept');
      assert.ok(record,'No signed migration or backup review receipt');
      assert.equal(record.receipt.evidenceSha256,hash,'Migration/backup hash differs from signed receipt');
    }
    migration={supplied:true,claimedRestored:migrationPacket.claimedRestored,
      independentlyVerified:false};
  }
  const visualMissing=REQUIRED_VISUAL_DECISIONS.filter(name=>
    !verified.acceptedVisualClaims.includes(name));
  return {
    sourceCommit,mode:'evidence-only-human-closure-preparation',
    witnessSignaturesVerified:witnessed.witnessedSignaturesVerified,
    custodyRevision:manifest.revision,
    appendedReceipts:verified.verifiedReceiptSignatures,
    operatorGateClaimGaps:rehearsal.releaseGateClaimsMissing,
    missingOriginalVisualDecisions:visualMissing,
    devicePacketScenarioClaims:packetCounts,
    migrationBackupClaims:migration,
    proofChainStructurallyVerified:true,
    trustRootsAuthenticatedOutsideInput:false,
    historyAnchorIndependentlyRegistered:false,
    originalSiteMigrationPhysicallyVerified:false,
    humanHardwareReviewVerified:false,
    humanAccessibilityReviewVerified:false,
    certifiedMainReleaseVerified:false,
    mergeAuthorized:false,deployAuthorized:false,publishAuthorized:false,
    releaseAuthorized:false,mergePerformed:false,deployPerformed:false,
    recoveryPerformed:false,cachePurged:false,liveUserDataAccessed:false,
    operatorAction:'STOP: independent owners must verify real evidence and approve separate release gates.',
  };
}
