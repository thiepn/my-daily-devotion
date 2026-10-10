import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';

const SHA = /^[0-9a-f]{40}$/, HASH = /^[0-9a-f]{64}$/;
const ROLES = new Set(['visual-reviewer','device-reviewer','migration-reviewer','release-operator']);
const ROOT_FIELDS = ['schemaVersion','sourceCommit','rootKeyId','revision','issuedAt','expiresAt','keys','revokedKeyIds','signatureBase64'];
const KEY_FIELDS = ['keyId','spkiDerBase64','sha256Pin','authorizedRoles'];
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function strictObject(value, keys) {
  assert.ok(value && typeof value==='object' && !Array.isArray(value), 'Expected metadata object');
  assert.deepEqual(Object.keys(value).filter(k=>!keys.includes(k)), [], 'Unexpected/private metadata field');
}
export function date(value) {
  assert.ok(typeof value==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value)), 'Invalid timestamp');
  return Date.parse(value);
}
export function bytes(value) {
  assert.ok(typeof value==='string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    value.length>0 && value.length<8192, 'Invalid base64');
  const data=Buffer.from(value,'base64');
  assert.equal(data.toString('base64'),value,'Noncanonical base64');
  return data;
}
export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
export function signedBody(envelope, fields) {
  strictObject(envelope,fields);
  const {signatureBase64,...signed}=envelope;
  return Buffer.from(canonical(signed));
}
/**
 * Verify custody signature under an explicitly, independently pinned root public key.
 * This does not demonstrate that the caller obtained the pin from a trusted channel.
 * No production signing or trust-root keys are distributed in the repository.
 */
export function verifyCustody({
  sourceCommit, rootPublicSpkiDerBase64, expectedRootSha256,
  minimumTrustedRevision, manifest, currentTime,
}) {
  assert.match(sourceCommit,SHA);
  assert.match(expectedRootSha256,HASH,'External custody fingerprint required');
  const rootDer=bytes(rootPublicSpkiDerBase64);
  assert.equal(sha256(rootDer),expectedRootSha256,'External custody pin mismatch');
  const rootKey=createPublicKey({key:rootDer,format:'der',type:'spki'});
  assert.equal(rootKey.asymmetricKeyType,'ed25519','Require Ed25519 custody root');
  signedBody(manifest,ROOT_FIELDS);
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.sourceCommit,sourceCommit,'Custody manifest belongs to another SHA');
  assert.ok(typeof manifest.rootKeyId==='string' && /^[A-Za-z0-9_.-]{2,64}$/.test(manifest.rootKeyId));
  assert.ok(Number.isSafeInteger(manifest.revision) && manifest.revision>0,'Custody revision missing');
  assert.ok(Number.isSafeInteger(minimumTrustedRevision) && minimumTrustedRevision>0,
    'Independently retained custody revision required');
  assert.ok(manifest.revision>=minimumTrustedRevision,'Signed custody revocation-state rollback');
  const now=date(currentTime),start=date(manifest.issuedAt),end=date(manifest.expiresAt);
  assert.ok(start<=now && now<=end && end-start<=24*60*60*1000,'Stale or future custody status');
  assert.ok(verify(null,signedBody(manifest,ROOT_FIELDS),rootKey,bytes(manifest.signatureBase64)),
    'Custody signature invalid');
  assert.ok(Array.isArray(manifest.keys) && manifest.keys.length>0 && manifest.keys.length<=20);
  assert.ok(Array.isArray(manifest.revokedKeyIds) && manifest.revokedKeyIds.length<=20);
  const revoked=new Set(manifest.revokedKeyIds);
  assert.equal(revoked.size,manifest.revokedKeyIds.length,'Duplicate revocation ID');
  const known=new Set();
  const roots=[];
  for (const item of manifest.keys) {
    strictObject(item,KEY_FIELDS);
    assert.ok(typeof item.keyId==='string' && /^[A-Za-z0-9_.-]{2,64}$/.test(item.keyId));
    assert.ok(!known.has(item.keyId),'Duplicate signing key');
    known.add(item.keyId);
    assert.match(item.sha256Pin,HASH);
    const publicBytes=bytes(item.spkiDerBase64);
    assert.equal(sha256(publicBytes),item.sha256Pin,'Signed key fingerprint mismatch');
    assert.equal(createPublicKey({key:publicBytes,format:'der',type:'spki'}).asymmetricKeyType,'ed25519');
    assert.ok(Array.isArray(item.authorizedRoles) && item.authorizedRoles.length>0 &&
      item.authorizedRoles.every(role=>ROLES.has(role)) &&
      new Set(item.authorizedRoles).size===item.authorizedRoles.length,'Invalid signing roles');
    if (!revoked.has(item.keyId)) roots.push({
      schemaVersion:1,keyId:item.keyId,spkiDerBase64:item.spkiDerBase64,
      sha256Pin:item.sha256Pin,revoked:false,validFrom:manifest.issuedAt,
      validUntil:manifest.expiresAt,authorizedRoles:item.authorizedRoles,
    });
  }
  assert.ok([...revoked].every(keyId=>known.has(keyId)),'Revocation references unknown key');
  return {
    sourceCommit,revision:manifest.revision,
    custodyManifestSignatureVerified:true,activeSignerRoots:roots,
    revokedKeyIds:[...revoked].sort(),
    trustPinIndependentlyAuthenticated:false,
    latestRevocationStatusIndependentlyConfirmed:false,
    releaseAuthorized:false,
  };
}
