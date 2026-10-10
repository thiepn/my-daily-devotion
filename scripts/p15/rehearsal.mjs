import assert from 'node:assert/strict';
import { verifyExistingOrigin } from '../p10/acceptance.mjs';
import { REQUIRED_VISUAL_DECISIONS } from './attestations.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const GATES=[
  'p8-reviewed-visuals','p9-qualified-exact-head','p10-p14-full-certification',
  'p1-original-origin-schema-migration','p1-encrypted-off-device-backup-restore',
  'p2-origin-and-path-safety','physical-android-chrome','physical-samsung-internet',
  'talkback-and-accessibility','independent-operator-merge','separate-operator-deploy',
  'exact-main-archive-revalidated','forward-compatible-recovery-rehearsed',
];
function exact(o,keys) {
  assert.ok(o && typeof o==='object' && !Array.isArray(o),'Expected rehearsal metadata');
  assert.deepEqual(Object.keys(o).filter(x=>!keys.includes(x)),[],'Unknown private or action fields');
}
function safeRecovery(r,sourceCommit,original) {
  exact(r,['sourceCommit','existingSiteUrl','candidateSiteUrl','installedSchema',
    'targetSchema','backupFormat','backupOffDeviceEncrypted','procedure','destructiveSteps','evidenceSha256']);
  assert.equal(r.sourceCommit,sourceCommit);
  verifyExistingOrigin(original,r.existingSiteUrl);
  verifyExistingOrigin(original,r.candidateSiteUrl);
  assert.ok(Number.isSafeInteger(r.installedSchema) && r.installedSchema>=3,'Installed schema must be >= 3');
  assert.ok(Number.isSafeInteger(r.targetSchema) && r.targetSchema>=r.installedSchema,'No database downgrade allowed');
  assert.equal(r.backupFormat,'portable-v1-encrypted');
  assert.equal(r.backupOffDeviceEncrypted,true,'Encrypted off-device backup required');
  assert.ok(['forward-compatible-fix','fresh-compatible-profile-restore'].includes(r.procedure));
  assert.deepEqual(r.destructiveSteps,[],'No destructive recovery steps permitted');
  assert.match(r.evidenceSha256,HASH);
}
/** Offline rehearsal with an unconditional release-denied invariant. */
export function rehearseCandidate({
  sourceCommit, originalSiteUrl, proposedSiteUrl, archiveEvidence,
  reviewInspection, gateClaims, recoveryPlan, operatorDecision,
}) {
  assert.match(sourceCommit,SHA,'Exact source commit SHA');
  verifyExistingOrigin(originalSiteUrl,proposedSiteUrl);
  exact(archiveEvidence,['sourceCommit','archiveSha256','localArtifactHashesVerified',
    'runId','artifactId']);
  assert.equal(archiveEvidence.sourceCommit,sourceCommit,'Archive evidence stale');
  assert.match(archiveEvidence.archiveSha256,HASH);
  assert.ok(Number.isSafeInteger(archiveEvidence.runId) && archiveEvidence.runId>0);
  assert.ok(Number.isSafeInteger(archiveEvidence.artifactId) && archiveEvidence.artifactId>0);
  assert.equal(typeof archiveEvidence.localArtifactHashesVerified,'boolean');
  exact(reviewInspection,['sourceCommit','requiredVisualDecisionsStillMissing','verifiedCryptographicSignatures',
    'releaseAuthorized']);
  assert.equal(reviewInspection.sourceCommit,sourceCommit,'Review packet stale');
  assert.equal(reviewInspection.releaseAuthorized,false,'A review packet must not authorize a release');
  assert.ok(Array.isArray(reviewInspection.requiredVisualDecisionsStillMissing),'Missing visual matrix');
  assert.ok(reviewInspection.requiredVisualDecisionsStillMissing.every(n=>REQUIRED_VISUAL_DECISIONS.includes(n)),
    'Unrecognized visual name');
  assert.ok(Number.isSafeInteger(reviewInspection.verifiedCryptographicSignatures) &&
    reviewInspection.verifiedCryptographicSignatures>=0);
  assert.ok(Array.isArray(gateClaims) && gateClaims.length===GATES.length,'Missing release gates');
  const names=new Set();
  for (const gate of gateClaims) {
    exact(gate,['id','claim']);
    assert.ok(GATES.includes(gate.id) && !names.has(gate.id),'Unknown or duplicate gate');
    names.add(gate.id);
    assert.ok(['OPEN','CLAIMED_PASS','FAILED'].includes(gate.claim),'Invalid gate claim');
  }
  assert.deepEqual([...names].sort(),[...GATES].sort());
  safeRecovery(recoveryPlan,sourceCommit,originalSiteUrl);
  exact(operatorDecision,['mode','mergeAuthorized','deployAuthorized','publicationAuthorized']);
  assert.equal(operatorDecision.mode,'dry-run-only','Release actions must remain disabled');
  assert.equal(operatorDecision.mergeAuthorized,false);
  assert.equal(operatorDecision.deployAuthorized,false);
  assert.equal(operatorDecision.publicationAuthorized,false);
  const recorded=Object.fromEntries(gateClaims.map(g=>[g.id,g.claim]));
  const lacking=GATES.filter(g=>recorded[g]!=='CLAIMED_PASS');
  const visuals=reviewInspection.requiredVisualDecisionsStillMissing;
  return {
    sourceCommit,mode:'nondeploying-rehearsal',
    claimedGateCount:gateClaims.filter(g=>g.claim==='CLAIMED_PASS').length,
    missingOrFailedGateClaims:lacking,
    requiredVisualDecisionsStillMissing:visuals,
    archiveByteCheckClaimed:archiveEvidence.localArtifactHashesVerified,
    exactMainRunClaimed:{runId:archiveEvidence.runId,artifactId:archiveEvidence.artifactId},
    sourceAuthorityIndependentlyAuthenticated:false,
    physicalDeviceHumanAcceptanceVerified:false,
    originalOriginMigrationIndependentlyVerified:false,
    recoveryPerformed:false,
    rollbackPerformed:false,
    releaseAuthorized:false,
    mergePerformed:false,deploymentPerformed:false,publicationPerformed:false,
    nextAction:'Independent operator must reconcile original CI, physical devices, backups and visual decisions. Do not release.',
  };
}
export function pendingRehearsalGates() {
  return GATES.map(id=>({id,claim:'OPEN'}));
}
