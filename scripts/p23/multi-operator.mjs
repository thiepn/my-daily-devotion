import assert from 'node:assert/strict';
import {createPublicKey,verify} from 'node:crypto';
import {bytes,canonical,date,sha256,strictObject} from '../p16/custody.mjs';
import {inspectExternalReview} from './external-review.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES=['source-operations-witness','independent-recovery-witness'];
const PINS=['role','witnessId','spkiDerBase64','sha256Pin'];
const SIGN_FIELDS=['role','witnessId','signatureBase64'];
const REQUEST_FIELDS=['schemaVersion','sourceCommit','p22ReviewDigestSha256',
 'immutableReleaseZipSha256','reviewLedgerDigestSha256','previousSequence',
 'previousDigest','sequence','nonce','disposition','createdAt','expiresAt','signatures'];
const OBSERVATION_FIELDS=['sourceCommit','previousSequence','previousDigest',
 'nonce','proposalDigestSha256'];
function message(request){
 strictObject(request,REQUEST_FIELDS);
 const {signatures,...body}=request;
 return Buffer.from('MDD-P23-MULTIOPERATOR-HOLD-V1\n'+canonical(body));
}
export function proposalDigest(request){
 return sha256(message(request));
}
/**
 * A signed conflict-free HOLD proposal, not a committed CAS write. External
 * registry custody, truly independent operators and real approval remain unknown.
 */
export function inspectMultiOperatorHold({
 sourceCommit,reviewInput,request,externalOperatorPins,
 trustedPreviousOperatorSequence,trustedPreviousOperatorDigest,
 previouslyUsedOperatorNonces,independentContentionObservations=[],
 currentTime,
}) {
 assert.match(sourceCommit,SHA);
 const review=inspectExternalReview({...reviewInput,sourceCommit,currentTime});
 assert.equal(review.releaseAuthorized,false);
 assert.ok(Number.isSafeInteger(trustedPreviousOperatorSequence)&&trustedPreviousOperatorSequence>=0);
 assert.match(trustedPreviousOperatorDigest,HASH);
 assert.ok(Array.isArray(previouslyUsedOperatorNonces)&&previouslyUsedOperatorNonces.length<=10000);
 const used=new Set();
 for(const nonce of previouslyUsedOperatorNonces){
   assert.match(nonce,UUID);assert.ok(!used.has(nonce),'Duplicate already used operator nonce');used.add(nonce);
 }
 strictObject(request,REQUEST_FIELDS);
 assert.equal(request.schemaVersion,1);
 assert.equal(request.sourceCommit,sourceCommit,'Multi-operator request stale source');
 assert.equal(request.p22ReviewDigestSha256,review.p22ReviewDigestSha256,
   'Request binds another P22 reviewed source');
 assert.equal(request.immutableReleaseZipSha256,review.immutableReleaseZipSha256,
   'Request binds another immutable ZIP');
 assert.equal(request.reviewLedgerDigestSha256,review.proposedNextReviewDigestSha256,
   'Request uses different reviewer ledger');
 assert.equal(request.disposition,'NO_GO_EVIDENCE_HOLD_NO_WRITE',
   'No executable release or ledger write allowed');
 assert.equal(request.previousSequence,trustedPreviousOperatorSequence,
   'External operator sequence floor mismatch');
 assert.equal(request.previousDigest,trustedPreviousOperatorDigest,
   'External operator chain fork');
 assert.equal(request.sequence,trustedPreviousOperatorSequence+1,'Operator monotonic sequence required');
 assert.match(request.nonce,UUID);
 assert.ok(!used.has(request.nonce),'Replay of operator request nonce');
 const created=date(request.createdAt),expires=date(request.expiresAt),now=date(currentTime);
 assert.ok(created<=now&&now<=expires&&expires-created<=3600000,
   'Operator HOLD request expired/future');
 const digest=proposalDigest(request);
 assert.ok(Array.isArray(independentContentionObservations)&&
   independentContentionObservations.length<=100,
   'Independent contention observations bounded');
 const competingNonces=new Set();
 for(const observation of independentContentionObservations){
   strictObject(observation,OBSERVATION_FIELDS);
   assert.equal(observation.sourceCommit,sourceCommit,'Contention witness wrong source');
   assert.match(observation.nonce,UUID);
   assert.match(observation.previousDigest,HASH);
   assert.match(observation.proposalDigestSha256,HASH);
   assert.ok(!competingNonces.has(observation.nonce),'Duplicate contention observation nonce');
   competingNonces.add(observation.nonce);
   if(observation.nonce===request.nonce)throw Error('Independent operator nonce already observed');
   if(observation.previousSequence===request.previousSequence&&
      observation.previousDigest===request.previousDigest)
     throw Error('Concurrent competing proposal on same externally retained sequence');
 }
 assert.ok(Array.isArray(externalOperatorPins)&&externalOperatorPins.length===2,
   'Two externally pinned independent HOLD witnesses required');
 assert.ok(Array.isArray(request.signatures)&&request.signatures.length===2);
 const pins=new Map(),ids=new Set(),fingerprints=new Set();
 for(const p of externalOperatorPins){
   strictObject(p,PINS);
   assert.ok(ROLES.includes(p.role)&&!pins.has(p.role),'Duplicate or unexpected operator role');
   assert.ok(typeof p.witnessId==='string'&&/^[A-Za-z0-9_.-]{2,64}$/.test(p.witnessId));
   assert.ok(!ids.has(p.witnessId),'Independent operator identities required');
   ids.add(p.witnessId);
   assert.match(p.sha256Pin,HASH);
   const der=bytes(p.spkiDerBase64);
   assert.equal(sha256(der),p.sha256Pin,'Independent operator public-key pin mismatch');
   assert.ok(!fingerprints.has(p.sha256Pin),'Multi-operator keys must be different');
   fingerprints.add(p.sha256Pin);
   const key=createPublicKey({key:der,format:'der',type:'spki'});
   assert.equal(key.asymmetricKeyType,'ed25519');
   pins.set(p.role,{key,id:p.witnessId});
 }
 assert.deepEqual([...pins.keys()].sort(),[...ROLES].sort());
 const verifiedRoles=new Set(),msg=message(request);
 for(const signature of request.signatures){
   strictObject(signature,SIGN_FIELDS);
   const pin=pins.get(signature.role);
   assert.ok(pin&&!verifiedRoles.has(signature.role),'Duplicate/unknown operator signature');
   verifiedRoles.add(signature.role);
   assert.equal(signature.witnessId,pin.id,'Wrong independent operator identity');
   assert.ok(verify(null,msg,pin.key,bytes(signature.signatureBase64)),
     'External operator witness signature invalid');
 }
 assert.deepEqual([...verifiedRoles].sort(),[...ROLES].sort());
 return {
   sourceCommit,decision:'NO_GO_EVIDENCE_HOLD_NO_WRITE',
   immutableReleaseZipSha256:review.immutableReleaseZipSha256,
   externalReviewDigestSha256:review.proposedNextReviewDigestSha256,
   holdProposalDigestSha256:digest,proposedSequence:request.sequence,
   independentExternalCASCommitted:false,
   multiOperatorConflictResolvedByTrustedRegistry:false,
   realPhysicalDeviceReviewAuthenticated:false,
   previousStableRestorePerformed:false,
   independentPrecutoverApproval:false,postreleaseReviewPerformed:false,
   releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false,
   publicationAuthorized:false,actionsPerformed:false,cachePurged:false,
   liveUserDataAccessed:false,
 };
}
