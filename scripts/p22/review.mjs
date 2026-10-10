import assert from 'node:assert/strict';
import {canonical,sha256,strictObject} from '../p16/custody.mjs';
import {verifyExistingOrigin} from '../p10/acceptance.mjs';
import {inspectP21OwnerClosure} from '../p21/owner-closure.mjs';
import {inspectSourceCustody} from './source-custody.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const SUBJECTS={
 'android-device':['android-chrome','android-samsung-internet'],
 'accessibility':['android-talkback','keyboard-and-focus','contrast-and-text-200'],
 'migration-backup':['original-origin-schema-migration','encrypted-off-device-backup-restore'],
};
const REVIEW_FIELDS=['sourceCommit','kind','subjectId','receiptDigest','evidenceSha256',
 'reviewStatus','physicalDeviceClaim','reviewedOnOriginalHostClaim'];
const STABLE_FIELDS=['sourceCommit','originalSiteUrl','previousStableCommit',
 'previousStableArchiveSha256','previousStableEvidenceSha256','offDeviceBackupSha256',
 'restoreAttemptEvidenceSha256','backupFormat','encryptedOffDevice','installedSchema',
 'repairTargetSchema','restoreProfile','disposition','deleteOriginalData','purgeCaches',
 'downgradeSchema','writeProductionJournal'];
const PENDING=['PENDING','REVIEW_REQUESTED','REJECTED'];
function digest(prefix,value){return sha256(Buffer.from(prefix+'\n'+canonical(value)));}
function reviewClaims(sourceCommit,packets,rows){
 assert.ok(Array.isArray(packets)&&packets.length<=20,'Review packet bound exceeded');
 const seen=new Set(),reported=[];
 for(const p of packets){
   strictObject(p,REVIEW_FIELDS);
   assert.equal(p.sourceCommit,sourceCommit,'Device/migration review source mismatch');
   assert.ok(Object.hasOwn(SUBJECTS,p.kind)&&SUBJECTS[p.kind].includes(p.subjectId),
     'Unexpected original-host/device/migration subject');
   const key=p.kind+'/'+p.subjectId;
   assert.ok(!seen.has(key),'Duplicate review packet');
   seen.add(key);
   assert.equal(p.physicalDeviceClaim,true,'Emulator cannot be recorded as physical review');
   assert.equal(p.reviewedOnOriginalHostClaim,true,
     'Original-host claim required; still not independent proof');
   assert.ok(PENDING.includes(p.reviewStatus),'Unverified review cannot claim approval');
   assert.match(p.receiptDigest,HASH);
   assert.match(p.evidenceSha256,HASH);
   const row=rows.find(r=>r.receipt?.sourceCommit===sourceCommit&&
     r.receipt.subjectType===p.kind&&r.receipt.subjectId===p.subjectId&&
     r.receipt.decision==='accept');
   assert.ok(row,'Source-bound signed reviewer receipt missing');
   assert.equal(row.digest,p.receiptDigest,'Wrong signed reviewer receipt digest');
   assert.equal(row.receipt.evidenceSha256,p.evidenceSha256,'Evidence object digest mismatch');
   reported.push(key);
 }
 return reported.sort();
}
function stableEvidence(sourceCommit,site,packet,reviewRows){
 if(packet===null)return {present:false,physicallyVerified:false};
 strictObject(packet,STABLE_FIELDS);
 assert.equal(packet.sourceCommit,sourceCommit,'Previous-stable recovery packet source mismatch');
 verifyExistingOrigin(site,packet.originalSiteUrl);
 assert.match(packet.previousStableCommit,SHA);
 assert.notEqual(packet.previousStableCommit,sourceCommit,
  'Previous-stable build must have distinct identified source');
 for(const f of ['previousStableArchiveSha256','previousStableEvidenceSha256',
   'offDeviceBackupSha256','restoreAttemptEvidenceSha256'])assert.match(packet[f],HASH);
 assert.ok(Number.isSafeInteger(packet.installedSchema)&&packet.installedSchema>=3);
 assert.ok(Number.isSafeInteger(packet.repairTargetSchema)&&
   packet.repairTargetSchema>=packet.installedSchema,'Downgrade of physical journal schema forbidden');
 assert.equal(packet.backupFormat,'portable-v1-encrypted');
 assert.equal(packet.encryptedOffDevice,true,'Encrypted backup must exist off-device');
 assert.equal(packet.restoreProfile,'disposable','Protected production profile restoration forbidden');
 assert.ok(PENDING.includes(packet.disposition),'Unverified restore must remain pending/denied');
 for(const f of ['deleteOriginalData','purgeCaches','downgradeSchema','writeProductionJournal'])
   assert.equal(packet[f],false,'Non-destructive recovery required');
 const backup=reviewRows.find(r=>r.receipt?.sourceCommit===sourceCommit&&
   r.receipt.subjectType==='migration-backup'&&
   r.receipt.subjectId==='encrypted-off-device-backup-restore'&&
   r.receipt.decision==='accept');
 assert.ok(backup,'Separately signed encrypted backup custody required');
 assert.equal(backup.receipt.evidenceSha256,packet.offDeviceBackupSha256,
   'Off-device backup reference not signed by source-bound reviewer');
 return {present:true,physicallyVerified:false,
   escrowDigestSha256:digest('MDD-P22-PREVIOUS-STABLE-V1',packet)};
}
/**
 * Re-evaluate actual P21 cryptographic NO_GO and archive bytes before reviewing
 * P22 source/rights escrow, device metadata, and previous-stable recovery claims.
 * This is never a deployment or a substitute for independent human approval.
 */
export function inspectP22Review({
 sourceCommit,p21OwnerInput,escrow,externalEscrowPins,
 trustedPreviousEscrowSequence,trustedPreviousEscrowDigest,
 previouslyUsedEscrowNonces,reviewPackets=[],previousStable=null,currentTime,
}) {
 assert.match(sourceCommit,SHA);
 const owner=inspectP21OwnerClosure({...p21OwnerInput,sourceCommit,currentTime});
 assert.equal(owner.releaseAuthorized,false);
 assert.equal(owner.postreleaseOperationOccurred,false);
 const p21=p21OwnerInput.p21Input;
 const host=p21.hostPacket,site=p21.p20Input.p19Input.p18Input.handoff.originalSiteUrl;
 const accepted=inspectSourceCustody({
   sourceCommit,originalSiteUrl:site,hostPacket:host,escrow,
   externalPins:externalEscrowPins,
   trustedPreviousSequence:trustedPreviousEscrowSequence,
   trustedPreviousDigest:trustedPreviousEscrowDigest,
   previouslyUsedEscrowNonces,currentTime,
 });
 assert.equal(accepted.releaseAuthorized,false);
 const rows=p21.p20Input.p19Input.p18Input.closureInput.records;
 const reviewed=reviewClaims(sourceCommit,reviewPackets,rows);
 const stable=stableEvidence(sourceCommit,site,previousStable,rows);
 const reviewDigestSha256=digest('MDD-P22-INDEPENDENT-REVIEW-V1',{
   sourceCommit,zip:owner.immutableArchiveSha256,
   ownerLedgerDigest:owner.nextOwnerLedgerDigestSha256,
   sourceEscrowDigest:accepted.sourceEscrowDigestSha256,
   reviewPackets,previousStable,
 });
 return {
   sourceCommit,decision:'INDEPENDENT_REVIEW_REQUIRED_NO_GO',
   immutableReleaseZipSha256:owner.immutableArchiveSha256,
   originalSiteUrl:site,sourceEscrowDigestSha256:accepted.sourceEscrowDigestSha256,
   ownerLedgerDigestSha256:owner.nextOwnerLedgerDigestSha256,
   reviewDigestSha256,receiptLinkedReviewClaims:reviewed,
   priorStableRecoveryClaim:stable,
   originalSourceAndRightsProvenanceStructurallyChecked:true,
   rightsOwnershipIndependentlyAuthenticated:false,
   cdnRightsAndPwaPhysicalAcceptanceVerified:false,
   physicalAndroidSamsungTalkBackReviewPerformed:false,
   encryptedOffDeviceRestorePerformed:false,
   externalTrustRootAndReplayHistoryIndependentlyOperated:false,
   actualPrecutoverOwnerApproval:false,actualPostreleaseReviewPerformed:false,
   exactMainReleaseCertificateAvailable:false,
   releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false,
   publicationAuthorized:false,recoveryPerformed:false,cachePurged:false,
   liveUserDataAccessed:false,actionsPerformed:false,
 };
}
