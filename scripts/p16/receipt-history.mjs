import assert from 'node:assert/strict';
import { createPublicKey, verify } from 'node:crypto';
import { inspectSignedAcceptance } from '../p15/attestations.mjs';
import { bytes, canonical, date, sha256, signedBody, strictObject, verifyCustody } from './custody.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHECK_FIELDS=['schemaVersion','sourceCommit','rootKeyId','fromSequence','priorDigest',
  'finalSequence','finalDigest','issuedAt','expiresAt','signatureBase64'];
const RECORD_FIELDS=['sequence','previousDigest','receipt','digest'];
export function recordDigest(record) {
  strictObject(record,RECORD_FIELDS);
  return sha256(Buffer.from('MDD-P16-RECEIPT-V1\n'+record.sequence+'\n'+
    record.previousDigest+'\n'+canonical(record.receipt)));
}
/**
 * Requires independent, trusted last ledger sequence/digest to prevent rollback/replay
 * between invocations. The source file alone cannot establish this trust.
 */
export function verifyReceiptHistory({
  sourceCommit, rootPublicSpkiDerBase64, expectedRootSha256, manifest,
  trustedPreviousAnchor, records, checkpoint, previouslyUsedNonces = [],
  codeAuthorHandles = [], currentTime,
}) {
  assert.match(sourceCommit,SHA);
  const custody=verifyCustody({
    sourceCommit,rootPublicSpkiDerBase64,expectedRootSha256,manifest,currentTime,
  });
  strictObject(trustedPreviousAnchor,['sequence','digest']);
  assert.ok(Number.isSafeInteger(trustedPreviousAnchor.sequence) &&
    trustedPreviousAnchor.sequence>=0,'Invalid external history sequence');
  assert.match(trustedPreviousAnchor.digest,HASH,'External history digest missing');
  assert.ok(Array.isArray(records) && records.length>0 && records.length<=100,
    'A new nonempty receipt history batch is required');
  assert.ok(Array.isArray(previouslyUsedNonces) && previouslyUsedNonces.length<=10000);
  assert.ok(Array.isArray(codeAuthorHandles) && codeAuthorHandles.length<=100);
  const knownNonces=new Set();
  for (const nonce of previouslyUsedNonces) {
    assert.match(nonce,UUID,'Invalid previous nonce');
    assert.ok(!knownNonces.has(nonce),'Duplicate historical nonce');
    knownNonces.add(nonce);
  }
  let sequence=trustedPreviousAnchor.sequence,digest=trustedPreviousAnchor.digest;
  const subjects=new Set(),claimedPlatforms=new Set(),claimedVisuals=new Set();
  let verifiedReceipts=0;
  for (const record of records) {
    strictObject(record,RECORD_FIELDS);
    assert.equal(record.sequence,sequence+1,'Ledger sequence skipped or replayed');
    assert.equal(record.previousDigest,digest,'Ledger history fork or replay');
    assert.match(record.digest,HASH);
    assert.equal(record.digest,recordDigest(record),'Receipt chain digest mismatch');
    assert.ok(record.receipt && typeof record.receipt==='object');
    assert.match(record.receipt.nonce,UUID,'Receipt nonce invalid');
    assert.ok(!knownNonces.has(record.receipt.nonce),'Receipt nonce replayed');
    const signer=custody.activeSignerRoots.find(x=>x.keyId===record.receipt.keyId);
    assert.ok(signer,'Receipt signed by unknown or revoked key');
    const reviewed=inspectSignedAcceptance({
      sourceCommit,trustRoot:signer,attestations:[record.receipt],
      previouslyUsedNonces:[...knownNonces],codeAuthorHandles,now:currentTime,
    });
    assert.equal(reviewed.verifiedCryptographicSignatures,1);
    const name=record.receipt.subjectType+'/'+record.receipt.subjectId;
    assert.ok(!subjects.has(name),'Duplicate subject decisions across receipts');
    subjects.add(name);
    if (record.receipt.decision==='accept') {
      if (record.receipt.subjectType==='visual') claimedVisuals.add(record.receipt.subjectId);
      if (['android-device','accessibility'].includes(record.receipt.subjectType))
        claimedPlatforms.add(record.receipt.subjectId);
    }
    knownNonces.add(record.receipt.nonce);
    sequence=record.sequence;digest=record.digest;verifiedReceipts++;
  }
  const rootDer=bytes(rootPublicSpkiDerBase64);
  assert.equal(sha256(rootDer),expectedRootSha256,'Checkpoint root pin mismatch');
  const rootKey=createPublicKey({key:rootDer,format:'der',type:'spki'});
  signedBody(checkpoint,CHECK_FIELDS);
  assert.equal(checkpoint.schemaVersion,1);
  assert.equal(checkpoint.sourceCommit,sourceCommit,'Checkpoint source commit changed');
  assert.equal(checkpoint.rootKeyId,manifest.rootKeyId,'Checkpoint custodian changed');
  assert.equal(checkpoint.fromSequence,trustedPreviousAnchor.sequence,'Checkpoint anchor sequence changed');
  assert.equal(checkpoint.priorDigest,trustedPreviousAnchor.digest,'Checkpoint anchor digest changed');
  assert.equal(checkpoint.finalSequence,sequence,'Checkpoint terminal sequence changed');
  assert.equal(checkpoint.finalDigest,digest,'Checkpoint terminal digest changed');
  const now=date(currentTime),start=date(checkpoint.issuedAt),end=date(checkpoint.expiresAt);
  assert.ok(start<=now && now<=end && end-start<=60*60*1000,
    'Checkpoint freshness invalid');
  assert.ok(verify(null,signedBody(checkpoint,CHECK_FIELDS),rootKey,
    bytes(checkpoint.signatureBase64)),'Checkpoint signature invalid');
  return {
    sourceCommit,sequence,digest,verifiedReceiptSignatures:verifiedReceipts,
    custodySignatureVerified:true,checkpointSignatureVerified:true,
    acceptedVisualClaims:[...claimedVisuals].sort(),
    acceptedDeviceOrAccessibilityClaims:[...claimedPlatforms].sort(),
    externalHistoryAnchorIndependentlyAuthenticated:false,
    realPhysicalDeviceEvidenceVerified:false,
    authenticatedReviewerAuthorityEstablished:false,
    releaseAuthorized:false,mergePerformed:false,deploymentPerformed:false,
  };
}
