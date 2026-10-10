import assert from 'node:assert/strict';
import {date,sha256,canonical,strictObject} from '../p16/custody.mjs';
import {verifyExistingOrigin} from '../p10/acceptance.mjs';
import {inspectP19Decision} from '../p19/decision.mjs';
import {inspectRotation} from './rotation.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PACKET_FIELDS=['sourceCommit','kind','subjectId','evidenceSha256','signedReceiptDigest',
  'claimedOutcome','claimedPhysical'];
const TICKET_FIELDS=['schemaVersion','sourceCommit','kind','nonce','createdAt',
  'operatorHoldDigestSha256','rotationIntentDigestSha256','releaseZipSha256',
  'originalSiteUrl','nextAction','allowMerge','allowDeployment','allowPublication',
  'allowLiveMigration','allowCachePurge','allowSchemaDowngrade'];
const SUBJECTS={
  'android-device':['android-chrome','android-samsung-internet'],
  'accessibility':['android-talkback','keyboard-and-focus','contrast-and-text-200'],
  'migration-backup':['original-origin-schema-migration','encrypted-off-device-backup-restore'],
};
/**
 * Reconcile signed claims. Does not authenticate physical operation or the
 * independent source of supplied pins, and never actuates a release.
 */
export function inspectP20Escalation({
  sourceCommit,p19Input,rotationInput,evidencePackets,ticket,
  previouslyUsedEscalationNonces,currentTime,
}) {
  assert.match(sourceCommit,SHA);
  const hold=inspectP19Decision({...p19Input,expectedSha:sourceCommit});
  assert.equal(hold.decision,'HOLD_FOR_INDEPENDENT_REVIEW');
  assert.equal(hold.releaseAuthorized,false);
  const rotation=inspectRotation({...rotationInput,sourceCommit,currentTime});
  const actualRecords=p19Input.p18Input.closureInput.records;
  assert.ok(Array.isArray(actualRecords) && actualRecords.length>0);
  assert.ok(Array.isArray(evidencePackets)&&evidencePackets.length<=30,'Too many review evidence packets');
  const seen=new Set();
  const missingOrUnverified={physicalDevices:[],accessibility:[],migrationBackup:[]};
  let matched=0;
  for(const e of evidencePackets){
    strictObject(e,PACKET_FIELDS);
    assert.equal(e.sourceCommit,sourceCommit,'Evidence packet stale source SHA');
    assert.ok(Object.hasOwn(SUBJECTS,e.kind),'Unknown protected review kind');
    assert.ok(SUBJECTS[e.kind].includes(e.subjectId),'Unknown review subject');
    const id=e.kind+'/'+e.subjectId;
    assert.ok(!seen.has(id),'Duplicate human evidence packet');
    seen.add(id);
    assert.match(e.evidenceSha256,HASH);
    assert.match(e.signedReceiptDigest,HASH);
    assert.equal(e.claimedPhysical,true,'Synthetic or emulator claim cannot qualify physical review');
    assert.ok(['PENDING','REVIEW_REQUESTED','REJECTED'].includes(e.claimedOutcome),
      'Unverified evidence cannot be marked approved');
    const row=actualRecords.find(x=>x.receipt?.subjectType===e.kind &&
      x.receipt.subjectId===e.subjectId && x.receipt.sourceCommit===sourceCommit &&
      x.receipt.decision==='accept');
    assert.ok(row,'Claim has no exact-source signed reviewer receipt');
    assert.equal(row.receipt.evidenceSha256,e.evidenceSha256,
      'Physical/migration evidence hash differs from signed receipt');
    assert.equal(row.digest,e.signedReceiptDigest,'Claim references a different signed receipt record');
    matched++;
  }
  for(const [kind,subjects] of Object.entries(SUBJECTS)){
    const group=kind==='android-device'?'physicalDevices':
      kind==='accessibility'?'accessibility':'migrationBackup';
    missingOrUnverified[group]=subjects.filter(subject=>!seen.has(kind+'/'+subject));
  }
  strictObject(ticket,TICKET_FIELDS);
  assert.equal(ticket.schemaVersion,1);
  assert.equal(ticket.sourceCommit,sourceCommit,'Escalation source SHA differs');
  assert.equal(ticket.kind,'MANUAL_EVIDENCE_REVIEW_HOLD');
  assert.equal(ticket.nextAction,'REQUEST_INDEPENDENT_OWNER_REVIEW');
  assert.match(ticket.operatorHoldDigestSha256,HASH);
  assert.match(ticket.rotationIntentDigestSha256,HASH);
  assert.match(ticket.releaseZipSha256,HASH);
  assert.equal(ticket.operatorHoldDigestSha256,hold.custodyRecordDigestSha256,
    'Ticket is bound to a different operator hold');
  assert.equal(ticket.rotationIntentDigestSha256,rotation.rotationIntentDigestSha256,
    'Ticket is bound to a different custody rotation');
  assert.equal(ticket.releaseZipSha256,hold.releaseZipSha256,
    'Ticket refers to different artifact bytes');
  verifyExistingOrigin(p19Input.p18Input.handoff.originalSiteUrl,ticket.originalSiteUrl);
  for(const action of ['allowMerge','allowDeployment','allowPublication',
    'allowLiveMigration','allowCachePurge','allowSchemaDowngrade']){
    assert.equal(ticket[action],false,'Executable release or destructive recovery prohibited');
  }
  assert.match(ticket.nonce,UUID);
  assert.ok(Array.isArray(previouslyUsedEscalationNonces) &&
    previouslyUsedEscalationNonces.length<=10000,'External escalation nonce history is mandatory');
  const seenNonces=new Set();
  for(const value of previouslyUsedEscalationNonces){
    assert.match(value,UUID);
    assert.ok(!seenNonces.has(value),'Duplicate history nonce');
    seenNonces.add(value);
  }
  assert.ok(!seenNonces.has(ticket.nonce),'Escalation ticket replayed');
  const now=date(currentTime),created=date(ticket.createdAt);
  assert.ok(created<=now&&now-created<=3600000,'Stale/future escalation request');
  return {
    sourceCommit,decision:'HOLD_ESCALATED_TO_INDEPENDENT_OWNER',
    operatorHoldDigestSha256:hold.custodyRecordDigestSha256,
    rotationIntentDigestSha256:rotation.rotationIntentDigestSha256,
    immutableReleaseZipSha256:hold.releaseZipSha256,
    evidenceClaimsMatchedToSignedReceipts:matched,
    absentReviewPackets:missingOrUnverified,
    ticketDigestSha256:sha256(Buffer.from('MDD-P20-ESCALATION-V1\n'+canonical(ticket))),
    externallyAuthenticatedOperatorCustody:false,
    rotationAndRevocationActuallyApplied:false,
    independentlyVerifiedPhysicalAndroid:false,
    independentlyVerifiedTalkBackAccessibility:false,
    independentlyVerifiedOriginalOriginMigrationAndBackup:false,
    certifiedMainReleaseArtifactAuthenticated:false,
    releaseAuthorized:false,mergeAuthorized:false,
    deployAuthorized:false,publicationAuthorized:false,
    actionsPerformed:false,cachePurged:false,liveDataAccessed:false,
    nextAction:'STOP and request separately authenticated owner, device and release decisions.',
  };
}
