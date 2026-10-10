import assert from 'node:assert/strict';
import {createPublicKey,verify} from 'node:crypto';
import {bytes,canonical,date,sha256,strictObject} from '../p16/custody.mjs';
import {inspectP21Evidence} from './evidence.mjs';

const HASH=/^[0-9a-f]{64}$/, UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES=['precutover-owner','postrelease-auditor'];
const PIN_FIELDS=['role','witnessId','spkiDerBase64','sha256Pin'];
const FIELDS=['schemaVersion','sourceCommit','role','decision','evidenceDigestSha256',
  'releaseZipSha256','originalSiteUrl','previousSequence','previousDigest',
  'nonce','issuedAt','expiresAt','signatureBase64'];
const DECISIONS=['PRE_CUTOVER_HOLD','POST_RELEASE_NOT_EXECUTED'];
function payload(record) {
 strictObject(record,FIELDS);
 const {signatureBase64,...body}=record;
 return Buffer.from('MDD-P21-HUMAN-RELEASE-DENIAL-V1\n'+canonical(body));
}
export function reviewDecisionDigest(record) {
 return sha256(Buffer.from('MDD-P21-REVIEW-CHAIN-V1\n'+canonical(record)));
}
/** Valid signatures prove integrity under supplied public keys, not human identity.
 * Neither accepted stage can give release authorization or claim a postrelease event. */
export function inspectP21OwnerClosure({
 sourceCommit,p21Input,ownerRecords,independentOwnerPins,
 trustedPreviousSequence,trustedPreviousDigest,
 previouslyUsedOwnerNonces,currentTime,
}) {
 const evidence=inspectP21Evidence({...p21Input,sourceCommit});
 assert.equal(evidence.releaseAuthorized,false,'Prior independent closure must remain denied');
 assert.ok(Array.isArray(ownerRecords)&&ownerRecords.length===2,
   'Separate pre-cutover and postrelease nonexecuting decisions are required');
 assert.ok(Array.isArray(independentOwnerPins)&&independentOwnerPins.length===2,
   'Two independently pinned owner/reviewer keys are required');
 assert.ok(Number.isSafeInteger(trustedPreviousSequence)&&trustedPreviousSequence>=0,
   'Externally trusted owner decision sequence required');
 assert.match(trustedPreviousDigest,HASH,'Trusted external decision-chain hash required');
 assert.ok(Array.isArray(previouslyUsedOwnerNonces)&&previouslyUsedOwnerNonces.length<=10000,
   'Externally retained nonce inventory required');
 const used=new Set();
 for(const value of previouslyUsedOwnerNonces){
   assert.match(value,UUID);
   assert.ok(!used.has(value),'Repeated external owner nonce');
   used.add(value);
 }
 const pinMap=new Map(),ids=new Set(),fingerprints=new Set();
 for(const pin of independentOwnerPins){
   strictObject(pin,PIN_FIELDS);
   assert.ok(ROLES.includes(pin.role)&&!pinMap.has(pin.role),
     'Duplicate or unknown owner role');
   assert.ok(typeof pin.witnessId==='string'&&/^[A-Za-z0-9_.-]{2,64}$/.test(pin.witnessId));
   assert.ok(!ids.has(pin.witnessId),'Pre/post reviewers must have distinct identity handles');
   ids.add(pin.witnessId);
   assert.match(pin.sha256Pin,HASH);
   const der=bytes(pin.spkiDerBase64);
   assert.equal(sha256(der),pin.sha256Pin,'External owner public-key pin mismatch');
   assert.ok(!fingerprints.has(pin.sha256Pin),'Precutover and postrelease cannot share the same key');
   fingerprints.add(pin.sha256Pin);
   const key=createPublicKey({key:der,format:'der',type:'spki'});
   assert.equal(key.asymmetricKeyType,'ed25519');
   pinMap.set(pin.role,{key});
 }
 assert.deepEqual([...pinMap.keys()].sort(),[...ROLES].sort());
 const digest=sha256(Buffer.from('MDD-P21-EVIDENCE-PACKET-V1\n'+canonical({
   sourceCommit,operatorHoldDigestSha256:evidence.operatorHoldDigestSha256,
   rotationIntentDigestSha256:evidence.rotationIntentDigestSha256,
   releaseZipSha256:evidence.immutableReleaseZipSha256,
   hostEvidenceDigestSha256:evidence.hostEvidenceDigestSha256,
 })));
 let sequence=trustedPreviousSequence,previousDigest=trustedPreviousDigest,
   previousIssued=0;
 const now=date(currentTime);
 for(let i=0;i<2;i++){
   const record=ownerRecords[i];
   strictObject(record,FIELDS);
   assert.equal(record.schemaVersion,1);
   assert.equal(record.sourceCommit,sourceCommit,'Cross-source human decision');
   assert.equal(record.role,ROLES[i],'Human decision role is not in stage order');
   assert.equal(record.decision,DECISIONS[i],
     'Human release decision cannot be converted to permission');
   assert.equal(record.evidenceDigestSha256,digest,'Decision refers to different physical or host evidence');
   assert.equal(record.releaseZipSha256,evidence.immutableReleaseZipSha256,
     'Human decision refers to different ZIP');
   assert.equal(record.originalSiteUrl,evidence.originalSiteUrl);
   assert.equal(record.previousSequence,sequence,'Owner decision chronology replay/skip');
   assert.equal(record.previousDigest,previousDigest,'Owner decision chain was forked');
   assert.match(record.nonce,UUID);
   assert.ok(!used.has(record.nonce),'Owner decision nonce replayed');
   used.add(record.nonce);
   const issued=date(record.issuedAt),expires=date(record.expiresAt);
   assert.ok(issued>=previousIssued,'Postrelease review precedes precutover review');
   assert.ok(issued<=now&&now<=expires&&expires-issued<=60*60*1000,
     'Human decision expired or future');
   previousIssued=issued;
   assert.ok(verify(null,payload(record),pinMap.get(record.role).key,bytes(record.signatureBase64)),
     'Independent owner decision signature invalid');
   previousDigest=reviewDecisionDigest(record);sequence++;
 }
 return {
   sourceCommit,decision:'NO_GO_RETAINED',
   reviewStages:['PRE_CUTOVER_HOLD','POST_RELEASE_NOT_EXECUTED'],
   verifiedSignatureClaims:2,
   nextOwnerLedgerSequence:sequence,nextOwnerLedgerDigestSha256:previousDigest,
   evidenceDigestSha256:digest,
   immutableArchiveSha256:evidence.immutableReleaseZipSha256,
   independentSignerIdentityVerifiedOutsidePacket:false,
   ownerReviewActuallyPerformed:false,physicalDeviceAcceptancePerformed:false,
   productionMainCertificateVerified:false,
   postreleaseOperationOccurred:false,releaseAuthorized:false,
   mergeAuthorized:false,deployAuthorized:false,publicationAuthorized:false,
   releaseActionsPerformed:false,recoveryPerformed:false,
 };
}
