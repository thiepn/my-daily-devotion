import assert from 'node:assert/strict';
import {createPublicKey,verify} from 'node:crypto';
import {bytes,canonical,date,sha256,strictObject} from '../p16/custody.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const NONCE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ROLES=['previous-signer','replacement-signer','independent-custodian'];
const PINS=['role','witnessId','spkiDerBase64','sha256Pin'];
const SIG=['role','witnessId','signatureBase64'];
const FIELDS=['schemaVersion','sourceCommit','previousKeyId','replacementKeyId',
  'previousKeySha256','replacementKeySha256','custodyKeySha256','sequence',
  'previousDigest','reason','event','nonce','issuedAt','expiresAt','signatures'];
const REASONS=['scheduled-rotation','suspected-compromise-review','revocation-recovery'];
const message=r=>{
  strictObject(r,FIELDS);
  const {signatures,...payload}=r;
  return Buffer.from('MDD-P20-ROTATION-ATTESTATION-V1\n'+canonical(payload));
};
/**
 * Cryptographic verification under independently supplied public pins.
 * It does NOT prove who controls those pins, live revocation freshness or operator approval.
 * Rotation cannot complete as an actual credential operation through this module.
 */
export function inspectRotation({
  sourceCommit,rotation,externalPins,previousSequence,previousDigest,
  previouslyUsedRotationNonces,previousActiveKeyId,previouslyRevokedKeyIds=[],
  currentTime,
}) {
  assert.match(sourceCommit,SHA);
  assert.ok(Number.isSafeInteger(previousSequence)&&previousSequence>=0);
  assert.match(previousDigest,HASH);
  assert.ok(Array.isArray(previouslyUsedRotationNonces)&&previouslyUsedRotationNonces.length<=10000);
  assert.ok(Array.isArray(previouslyRevokedKeyIds)&&previouslyRevokedKeyIds.length<=10000);
  const used=new Set();
  for(const x of previouslyUsedRotationNonces){
    assert.match(x,NONCE);
    assert.ok(!used.has(x),'Duplicate retained rotation nonce');
    used.add(x);
  }
  const revoked=new Set(previouslyRevokedKeyIds);
  assert.equal(revoked.size,previouslyRevokedKeyIds.length,'Duplicated revoked signer');
  strictObject(rotation,FIELDS);
  assert.equal(rotation.schemaVersion,1);
  assert.equal(rotation.sourceCommit,sourceCommit,'Rotation stale source SHA');
  assert.equal(rotation.event,'ROTATE_AND_REVOKE_PREVIOUS','Only fail-closed rotation intent allowed');
  assert.ok(REASONS.includes(rotation.reason));
  assert.equal(rotation.previousKeyId,previousActiveKeyId,'Previous signer differs from retained active key');
  assert.ok(typeof rotation.previousKeyId==='string'&&/^[a-zA-Z0-9_.-]{2,64}$/.test(rotation.previousKeyId));
  assert.ok(typeof rotation.replacementKeyId==='string'&&/^[a-zA-Z0-9_.-]{2,64}$/.test(rotation.replacementKeyId));
  assert.notEqual(rotation.previousKeyId,rotation.replacementKeyId,'Replacement identity must change');
  assert.ok(!revoked.has(rotation.previousKeyId),'Previously revoked signer cannot initiate routine rotation');
  assert.ok(!revoked.has(rotation.replacementKeyId),'Replacement signer was previously revoked');
  assert.match(rotation.previousKeySha256,HASH);
  assert.match(rotation.replacementKeySha256,HASH);
  assert.match(rotation.custodyKeySha256,HASH);
  assert.equal(rotation.sequence,previousSequence+1,'Rotation sequence skip or rollback');
  assert.equal(rotation.previousDigest,previousDigest,'Rotation custody history fork');
  assert.match(rotation.nonce,NONCE);
  assert.ok(!used.has(rotation.nonce),'Rotation nonce replayed');
  const now=date(currentTime),issued=date(rotation.issuedAt),expires=date(rotation.expiresAt);
  assert.ok(issued<=now && now<=expires && expires-issued<=60*60*1000,
    'Rotation attestation expired or future');
  assert.ok(Array.isArray(externalPins)&&externalPins.length===3,'Three separately retained signer pins required');
  assert.ok(Array.isArray(rotation.signatures)&&rotation.signatures.length===3,'Three signer attestations required');
  const pins=new Map(),fingerprints=new Set(),identities=new Set();
  for(const p of externalPins){
    strictObject(p,PINS);
    assert.ok(ROLES.includes(p.role)&&!pins.has(p.role),'Duplicate/unknown rotation role');
    assert.ok(typeof p.witnessId==='string'&&/^[a-zA-Z0-9_.-]{2,64}$/.test(p.witnessId));
    assert.ok(!identities.has(p.witnessId),'Identical signer identities prohibited');
    identities.add(p.witnessId);
    assert.match(p.sha256Pin,HASH);
    const der=bytes(p.spkiDerBase64);
    assert.equal(sha256(der),p.sha256Pin,'Externally pinned rotation key mismatch');
    assert.ok(!fingerprints.has(p.sha256Pin),'Distinct cryptographic keys required');
    fingerprints.add(p.sha256Pin);
    const key=createPublicKey({key:der,format:'der',type:'spki'});
    assert.equal(key.asymmetricKeyType,'ed25519');
    pins.set(p.role,{witnessId:p.witnessId,sha256Pin:p.sha256Pin,key});
  }
  assert.deepEqual([...pins.keys()].sort(),[...ROLES].sort());
  assert.equal(rotation.previousKeySha256,pins.get('previous-signer').sha256Pin);
  assert.equal(rotation.replacementKeySha256,pins.get('replacement-signer').sha256Pin);
  assert.equal(rotation.custodyKeySha256,pins.get('independent-custodian').sha256Pin);
  const signed=message(rotation),seen=new Set();
  for(const s of rotation.signatures){
    strictObject(s,SIG);
    const p=pins.get(s.role);
    assert.ok(p&&!seen.has(s.role),'Duplicate or unknown rotation signature');
    seen.add(s.role);
    assert.equal(s.witnessId,p.witnessId,'Rotation witness identity mismatch');
    assert.ok(verify(null,signed,p.key,bytes(s.signatureBase64)),'Rotation signature failed');
  }
  assert.deepEqual([...seen].sort(),[...ROLES].sort());
  return {
    sourceCommit,sequence:rotation.sequence,
    newActiveKeyIdClaim:rotation.replacementKeyId,
    newlyRevokedKeyIdClaim:rotation.previousKeyId,
    rotationIntentDigestSha256:sha256(signed),verifiedSignatures:3,
    externalPinOwnershipIndependentlyVerified:false,
    revocationPublishedToLiveVerifier:false,
    replacementSignerActuallyActivated:false,
    suspectedCompromiseHumanCleared:false,
    releaseAuthorized:false,actionsPerformed:false,
  };
}
