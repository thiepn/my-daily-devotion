import assert from 'node:assert/strict';
import { REQUIRED_VISUAL_DECISIONS } from '../p15/attestations.mjs';
import { pendingRehearsalGates, rehearseCandidate } from '../p15/rehearsal.mjs';
import { strictObject } from './custody.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const SCENARIOS={
  'android-chrome':['offline-cold-start','background-resume','ime-writing','storage-pressure','service-worker-update'],
  'android-samsung-internet':['offline-cold-start','background-resume','ime-writing','storage-pressure'],
  'android-talkback':['talkback-navigation','keyboard-focus','text-200','contrast-review'],
  'keyboard-and-focus':['keyboard-focus'],
  'contrast-and-text-200':['text-200','contrast-review'],
};
const DEVICE_FIELDS=['sourceCommit','subjectId','scenarioIds','evidenceSha256','observerHandle','claimedPhysical'];
/** Only the hash and coarse scenario metadata of real-device evidence are accepted.
    Neither claim status nor signature truth verifies the presence of physical hardware. */
export function inspectDeviceClaims({sourceCommit,historyRecords,deviceClaims}) {
  assert.match(sourceCommit,SHA);
  assert.ok(Array.isArray(historyRecords) && Array.isArray(deviceClaims) && deviceClaims.length<=20);
  const signed=new Map();
  for(const record of historyRecords) {
    const r=record.receipt;
    if (!r || r.decision!=='accept' ||
      !['android-device','accessibility'].includes(r.subjectType)) continue;
    assert.ok(!signed.has(r.subjectId),'Duplicate device attestation');
    signed.set(r.subjectId,r);
  }
  const seen=new Set(),results={};
  for(const item of deviceClaims) {
    strictObject(item,DEVICE_FIELDS);
    assert.equal(item.sourceCommit,sourceCommit,'Stale device evidence');
    assert.ok(Object.hasOwn(SCENARIOS,item.subjectId),'Unknown device/accessibility subject');
    assert.ok(!seen.has(item.subjectId),'Duplicate physical-device checklist');
    seen.add(item.subjectId);
    assert.ok(Array.isArray(item.scenarioIds) && item.scenarioIds.length>0 &&
      new Set(item.scenarioIds).size===item.scenarioIds.length,'Duplicate/empty scenario list');
    assert.ok(item.scenarioIds.every(s=>SCENARIOS[item.subjectId].includes(s)),'Unknown scenario');
    assert.equal(item.claimedPhysical,true,'Emulator evidence cannot claim physical approval');
    assert.match(item.evidenceSha256,HASH);
    const attestation=signed.get(item.subjectId);
    assert.ok(attestation,'Device claim missing signed receipt');
    assert.equal(item.evidenceSha256,attestation.evidenceSha256,'Evidence hash differs from signed receipt');
    assert.equal(item.observerHandle,attestation.reviewerHandle,'Observer differs from signed claim');
    assert.equal(attestation.sourceCommit,sourceCommit,'Attested device belongs to another source');
    results[item.subjectId]={claimedScenarioCount:item.scenarioIds.length,
      missingScenarioClaims:SCENARIOS[item.subjectId].filter(s=>!item.scenarioIds.includes(s)),
      verifiedOnPhysicalHardware:false};
  }
  for(const id of Object.keys(SCENARIOS)) {
    if(!Object.hasOwn(results,id))results[id]={claimedScenarioCount:0,
      missingScenarioClaims:[...SCENARIOS[id]],verifiedOnPhysicalHardware:false};
  }
  return {sourceCommit,claims:results,realDeviceIndependentlyVerified:false,
    reviewerAuthorityIndependentlyVerified:false};
}
export function inspectOperatorClosure({
  sourceCommit,originalSiteUrl,archiveEvidence,verifiedHistory,
  historyRecords,deviceClaims,recoveryPlan,gateClaims=pendingRehearsalGates(),
}) {
  assert.match(sourceCommit,SHA);
  assert.equal(verifiedHistory.sourceCommit,sourceCommit,'Stale history');
  assert.equal(verifiedHistory.releaseAuthorized,false,'History must not authorize release');
  assert.ok(verifiedHistory.custodySignatureVerified &&
    verifiedHistory.checkpointSignatureVerified,'Missing authenticated custody/checkpoint signatures');
  const devices=inspectDeviceClaims({sourceCommit,historyRecords,deviceClaims});
  const remaining=REQUIRED_VISUAL_DECISIONS.filter(name=>
    !verifiedHistory.acceptedVisualClaims.includes(name));
  const rehearsal=rehearseCandidate({sourceCommit,originalSiteUrl,proposedSiteUrl:originalSiteUrl,
    archiveEvidence,reviewInspection:{
      sourceCommit,requiredVisualDecisionsStillMissing:remaining,
      verifiedCryptographicSignatures:verifiedHistory.verifiedReceiptSignatures,
      releaseAuthorized:false,
    },gateClaims,recoveryPlan,operatorDecision:{
      mode:'dry-run-only',mergeAuthorized:false,deployAuthorized:false,publicationAuthorized:false,
    }});
  return {
    sourceCommit,mode:'nondeploying-operator-evidence-rehearsal',
    cryptographicReceiptClaimCount:verifiedHistory.verifiedReceiptSignatures,
    missingVisualClaims:remaining,deviceScenarioClaims:devices.claims,
    releaseGateClaimsMissing:rehearsal.missingOrFailedGateClaims,
    independentlyPinnedTrustCustodyVerified:false,
    authenticHumanApprovalVerified:false,physicalAndroidAcceptanceVerified:false,
    originalOriginMigrationVerified:false,encryptedBackupRestoreVerified:false,
    exactMainReleaseCertificateVerified:false,
    releaseAuthorized:false,mergePerformed:false,deploymentPerformed:false,
    cachePurged:false,liveDataAccessed:false,
    blockers:['P8 independent screenshot decisions','P9 qualification and restack',
      'P1/P2 original-origin migration/backup','physical Android/accessibility human testing',
      'exact-main certification and separate operator merge/deploy/publication approvals'],
  };
}
