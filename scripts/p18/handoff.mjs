import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectP17Closure} from '../p17/closure.mjs';
import {inspectCandidate} from '../p12/candidate.mjs';
import {examineGithubRun} from '../p13/provenance.mjs';
import {canonical,strictObject} from '../p16/custody.mjs';
import {verifyExistingOrigin} from '../p10/acceptance.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const DECISION_FIELDS=['mode','mergeAuthorized','deployAuthorized','publicationAuthorized',
  'allowLiveMigration','allowCachePurge','allowRollback'];
const HANDOFF_FIELDS=['sourceCommit','originalSiteUrl','decision','reviewHandoffNonce',
  'minimumCustodyRevision','minimumLedgerSequence'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validateDecision(decision) {
  strictObject(decision,DECISION_FIELDS);
  assert.equal(decision.mode,'evidence-only','No executable release mode');
  for(const k of DECISION_FIELDS.slice(1))assert.equal(decision[k],false,
    'Operator action forbidden: '+k);
}
function reviewNonce({reviewHandoffNonce,previouslyUsedHandoffNonces}) {
  assert.match(reviewHandoffNonce,UUID,'Random handoff nonce required');
  assert.ok(Array.isArray(previouslyUsedHandoffNonces) &&
    previouslyUsedHandoffNonces.length<=10000);
  const prior=new Set();
  for(const n of previouslyUsedHandoffNonces){
    assert.match(n,UUID);assert.ok(!prior.has(n),'Duplicate external handoff nonce history');
    prior.add(n);
  }
  assert.ok(!prior.has(reviewHandoffNonce),'Replayed operator handoff nonce');
}
/**
 * One offline *evidence-only* inspection. Re-verify actual immutable ZIP bytes via
 * P12, verify signed/witnessed provenance via P17, optionally corroborate the
 * main-branch run metadata via P13. No component grants authority to launch.
 * The authenticity of operator-provided witness pins, GitHub JSON, and history
 * floors must be assessed via independent protected sources outside this module.
 */
export function inspectIndependentHandoff({
  expectedSha,handoff,closureInput,candidateInput,githubEvidence=null,
  previouslyUsedHandoffNonces,
}) {
  assert.match(expectedSha,SHA,'Exact release source SHA required');
  strictObject(handoff,HANDOFF_FIELDS);
  assert.equal(handoff.sourceCommit,expectedSha,'Handoff source mismatch');
  verifyExistingOrigin(handoff.originalSiteUrl,handoff.originalSiteUrl);
  validateDecision(handoff.decision);
  assert.ok(Array.isArray(previouslyUsedHandoffNonces),
    'Independent handoff nonce history required');
  reviewNonce({reviewHandoffNonce:handoff.reviewHandoffNonce,previouslyUsedHandoffNonces});
  assert.ok(Number.isSafeInteger(handoff.minimumCustodyRevision) &&
    handoff.minimumCustodyRevision>0);
  assert.ok(Number.isSafeInteger(handoff.minimumLedgerSequence) &&
    handoff.minimumLedgerSequence>=0);
  assert.equal(closureInput.sourceCommit,expectedSha,'P17 evidence source mismatch');
  assert.equal(closureInput.minimumAcceptedRevision,handoff.minimumCustodyRevision,
    'External custody revision floor differs');
  assert.equal(closureInput.minimumAcceptedSequence,handoff.minimumLedgerSequence,
    'External ledger floor differs');
  verifyExistingOrigin(handoff.originalSiteUrl,closureInput.originalSiteUrl);
  assert.equal(candidateInput.expectedSha,expectedSha,'Actual archive source mismatch');
  const candidate=inspectCandidate(candidateInput);
  assert.equal(candidate.localArtifactHashesVerified,true);
  assert.equal(closureInput.archiveEvidence.sourceCommit,expectedSha);
  assert.equal(closureInput.archiveEvidence.archiveSha256,candidate.archiveSha256,
    'P17 reviewed artifact differs from actual immutable bytes');
  assert.equal(closureInput.archiveEvidence.localArtifactHashesVerified,true,
    'P17 must not assert an unchecked archive');
  let github=null;
  if(githubEvidence!==null) {
    strictObject(githubEvidence,['run','jobs','artifacts']);
    github=examineGithubRun({...githubEvidence,sourceCommit:expectedSha});
    assert.equal(closureInput.archiveEvidence.runId,github.runId,
      'Operator reviewed another workflow run');
    assert.equal(closureInput.archiveEvidence.artifactId,github.artifactId,
      'Operator reviewed another artifact ID');
  }
  const closure=inspectP17Closure(closureInput);
  assert.equal(closure.sourceCommit,expectedSha);
  assert.equal(closure.releaseAuthorized,false,'Inherited closure must stay denied');
  assert.equal(closure.deployPerformed,false);
  assert.equal(closure.mergePerformed,false);
  const digestData={
    sourceCommit:expectedSha,originalSiteUrl:handoff.originalSiteUrl,
    custodyRevision:closure.custodyRevision,receiptCount:closure.appendedReceipts,
    localArchiveSha256:candidate.archiveSha256,version:candidate.version,
    certifiedMainRunClaim:github?github.runId:null,
    certifiedMainArtifactClaim:github?github.artifactId:null,
    evidenceHandoffNonce:handoff.reviewHandoffNonce,
  };
  const digest=createHash('sha256').update('MDD-P18-EVIDENCE-HANDOFF-V1\n'+canonical(digestData)).digest('hex');
  assert.match(digest,HASH);
  return {
    schemaVersion:1,sourceCommit:expectedSha,handoffDigestSha256:digest,
    immutableLocalReleaseZipVerified:true,fileCount:candidate.fileCount,
    releaseZipSha256:candidate.archiveSha256,
    githubRunMetadataCorroborated:github!==null,
    artifactIdClaim:github?.artifactId??null,
    witnessedCustodySignatureClaims:closure.witnessSignaturesVerified,
    sourceBoundReviewerReceiptCount:closure.appendedReceipts,
    outstandingVisualDecisions:closure.missingOriginalVisualDecisions,
    missingOperatorGateClaims:closure.operatorGateClaimGaps,
    devicePacketClaimsCount:Object.keys(closure.devicePacketScenarioClaims).length,
    migrationAndBackupClaimSupplied:closure.migrationBackupClaims.supplied,
    trustPinsAuthenticatedOutOfBand:false,
    previousNonceRegistryAuthenticatedOutOfBand:false,
    githubApiResponsesIndependentlyAuthenticated:false,
    externalHumanApprovalVerified:false,physicalAndroidVerified:false,
    accessibilityHumanApprovalVerified:false,migrationRestorePhysicallyVerified:false,
    productionReleaseCertificateVerified:false,
    releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false,
    publicationAuthorized:false,
    actionsPerformed:false,liveDataAccessed:false,cachePurged:false,
    requiredOperatorAction:'BLOCK — independent reviewers must authenticate real source, human, device, origin, backup and exact-main evidence.',
  };
}
