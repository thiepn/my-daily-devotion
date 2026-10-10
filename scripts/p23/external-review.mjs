import assert from 'node:assert/strict';
import {createPublicKey,verify} from 'node:crypto';
import {bytes,canonical,date,sha256,strictObject} from '../p16/custody.mjs';
import {inspectP22Review} from '../p22/review.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES=['rights-provenance-witness','physical-accessibility-witness','recovery-escrow-witness'];
const PIN_FIELDS=['role','witnessId','spkiDerBase64','sha256Pin','keyRevision'];
const RECEIPT_FIELDS=['schemaVersion','sourceCommit','parentReviewDigestSha256','subjectType',
  'subjectId','evidenceSha256','status','signerRole','signerId','keyRevision','sequence',
  'previousDigest','nonce','issuedAt','expiresAt','signatureBase64'];
const SUBJECT_TYPES=['source-material','physical-review','previous-stable'];
const MATERIAL_ROLES={
 'source-material':'rights-provenance-witness',
 'physical-review':'physical-accessibility-witness',
 'previous-stable':'recovery-escrow-witness',
};
function message(record){
 strictObject(record,RECEIPT_FIELDS);
 const {signatureBase64,...content}=record;
 return Buffer.from('MDD-P23-EXTERNAL-REVIEW-V1\n'+canonical(content));
}
export function externalReceiptDigest(record){
 return sha256(Buffer.from('MDD-P23-REVIEW-RECEIPT-DIGEST-V1\n'+canonical(record)));
}
/** Source-bound *claims* authenticated under separately supplied keys, not proof
 * that an independent reviewer or physical device truly exists. This neither
 * issues credentials nor commits the proposed receipt sequence to a registry.
 */
export function inspectExternalReview({
 sourceCommit,p22Input,externalReviewerPins,externallyRevokedWitnessIds=[],
 minimumTrustedKeyRevision,previousReviewSequence,previousReviewDigest,
 previouslyUsedReviewNonces,receipts=[],currentTime,
}) {
 assert.match(sourceCommit,SHA);
 const parent=inspectP22Review({...p22Input,sourceCommit,currentTime});
 assert.equal(parent.releaseAuthorized,false);
 assert.ok(Number.isSafeInteger(minimumTrustedKeyRevision)&&minimumTrustedKeyRevision>0,
   'External minimum key revision required');
 assert.ok(Number.isSafeInteger(previousReviewSequence)&&previousReviewSequence>=0);
 assert.match(previousReviewDigest,HASH,'Externally retained review digest required');
 assert.ok(Array.isArray(previouslyUsedReviewNonces)&&previouslyUsedReviewNonces.length<=10000);
 assert.ok(Array.isArray(externallyRevokedWitnessIds)&&externallyRevokedWitnessIds.length<=10000);
 const revoked=new Set(externallyRevokedWitnessIds);
 assert.equal(revoked.size,externallyRevokedWitnessIds.length,'Duplicate revoked reviewer');
 for(const id of revoked)assert.match(id,/^[A-Za-z0-9_.-]{2,64}$/);
 const nonces=new Set();
 for(const nonce of previouslyUsedReviewNonces){
   assert.match(nonce,UUID);assert.ok(!nonces.has(nonce),'Duplicate retained nonce');
   nonces.add(nonce);
 }
 assert.ok(Array.isArray(externalReviewerPins)&&externalReviewerPins.length===3,
   'Three separately sourced reviewer pins required');
 const pins=new Map(),ids=new Set(),fingerprints=new Set();
 for(const p of externalReviewerPins){
   strictObject(p,PIN_FIELDS);
   assert.ok(ROLES.includes(p.role)&&!pins.has(p.role),'Duplicate/unknown external reviewer role');
   assert.ok(typeof p.witnessId==='string'&&/^[A-Za-z0-9_.-]{2,64}$/.test(p.witnessId));
   assert.ok(!ids.has(p.witnessId),'Reviewer identities must differ');
   assert.ok(!revoked.has(p.witnessId),'Revoked external witness cannot authorize review');
   ids.add(p.witnessId);
   assert.ok(Number.isSafeInteger(p.keyRevision) && p.keyRevision>=minimumTrustedKeyRevision,
     'Externally held revision floor rejects old reviewer key');
   assert.match(p.sha256Pin,HASH);
   const der=bytes(p.spkiDerBase64);
   assert.equal(sha256(der),p.sha256Pin,'External reviewer key pin mismatch');
   assert.ok(!fingerprints.has(p.sha256Pin),'Independent reviewer keys must differ');
   fingerprints.add(p.sha256Pin);
   const key=createPublicKey({key:der,format:'der',type:'spki'});
   assert.equal(key.asymmetricKeyType,'ed25519');
   pins.set(p.role,{id:p.witnessId,key,revision:p.keyRevision});
 }
 assert.deepEqual([...pins.keys()].sort(),[...ROLES].sort());
 assert.ok(Array.isArray(receipts)&&receipts.length<=18,'Review receipts bounded to 18');
 const siteMaterials=new Map(p22Input.escrow.materials.map(x=>[x.kind,x.evidenceSha256]));
 const deviceMaterials=new Map(p22Input.reviewPackets.map(x=>[x.kind+'/'+x.subjectId,x.evidenceSha256]));
 const stable=p22Input.previousStable;
 let seq=previousReviewSequence,prior=previousReviewDigest,previousIssued=0;
 const subjects=new Set(),summaries=[];
 const now=date(currentTime);
 for(const receipt of receipts){
   strictObject(receipt,RECEIPT_FIELDS);
   assert.equal(receipt.schemaVersion,1);
   assert.equal(receipt.sourceCommit,sourceCommit,'Review receipt source mismatch');
   assert.equal(receipt.parentReviewDigestSha256,parent.reviewDigestSha256,
     'Review must bind exact previous P22 source/device/owner evidence');
   assert.ok(SUBJECT_TYPES.includes(receipt.subjectType),'Unknown review subject type');
   const role=MATERIAL_ROLES[receipt.subjectType],pin=pins.get(role);
   assert.equal(receipt.signerRole,role,'Reviewer cannot sign outside their subject authority');
   assert.equal(receipt.signerId,pin.id,'Reviewer ID differs from independently pinned key');
   assert.equal(receipt.keyRevision,pin.revision,'Revision substitution or rollback');
   assert.match(receipt.evidenceSha256,HASH);
   let expected;
   if(receipt.subjectType==='source-material')expected=siteMaterials.get(receipt.subjectId);
   else if(receipt.subjectType==='physical-review')expected=deviceMaterials.get(receipt.subjectId);
   else if(receipt.subjectType==='previous-stable'&&receipt.subjectId==='encrypted-forward-recovery')
     expected=stable?.previousStableEvidenceSha256;
   assert.ok(expected,'No actual source-bound subject evidence available');
   assert.equal(receipt.evidenceSha256,expected,'Review digest differs from accepted source evidence');
   assert.ok(['REVIEW_PENDING','REJECTED'].includes(receipt.status),
     'Human approval cannot be self-asserted');
   const subject=receipt.subjectType+'/'+receipt.subjectId;
   assert.ok(!subjects.has(subject),'Duplicate reviewer subject');
   subjects.add(subject);
   assert.equal(receipt.sequence,seq+1,'Review sequence rollback or skip');
   assert.equal(receipt.previousDigest,prior,'Review custody fork or replay');
   assert.match(receipt.nonce,UUID);
   assert.ok(!nonces.has(receipt.nonce),'Replayed reviewer receipt nonce');
   nonces.add(receipt.nonce);
   const issued=date(receipt.issuedAt),expires=date(receipt.expiresAt);
   assert.ok(issued>=previousIssued,'Review chronology moved backwards');
   assert.ok(issued<=now&&now<=expires&&expires-issued<=3600000,
     'Review evidence expired or future');
   previousIssued=issued;
   assert.ok(verify(null,message(receipt),pin.key,bytes(receipt.signatureBase64)),
     'External reviewer attestation signature invalid');
   prior=externalReceiptDigest(receipt);seq++;
   summaries.push({subject,reviewStatus:receipt.status});
 }
 return {
   sourceCommit,decision:'EXTERNAL_REVIEW_CUSTODY_PENDING',
   p22ReviewDigestSha256:parent.reviewDigestSha256,
   immutableReleaseZipSha256:parent.immutableReleaseZipSha256,
   previousExternalSequence:previousReviewSequence,
   proposedNextReviewSequence:seq,proposedNextReviewDigestSha256:prior,
   attestedReviewClaims:summaries,
   independentReviewerIdentityAuthenticatedOutsideInputs:false,
   externallyOperatedRevocationRegistryVerified:false,
   externallyCommittedAntiReplayLedger:false,
   physicalDeviceAndAccessibilityReviewPerformed:false,
   originalObjectRightsApproved:false,cdnOrPwaReleaseRightsApproved:false,
   encryptedOffDeviceRecoveryActuallyTested:false,
   releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false,
   publicationAuthorized:false,releaseActionsPerformed:false,
 };
}
