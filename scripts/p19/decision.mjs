import assert from 'node:assert/strict';
import {createPublicKey, verify, createHash} from 'node:crypto';
import {canonical, bytes, date, sha256, strictObject} from '../p16/custody.mjs';
import {inspectIndependentHandoff} from '../p18/handoff.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const GATES=Object.freeze([
  'p8-nine-independent-visual-decisions','p9-qualified-provenance-origin-rollback',
  'p10-p18-requalified-exact-head-chain','p1-original-origin-migration',
  'p2-encrypted-off-device-backup-restore','android-chrome-physical-review',
  'samsung-internet-physical-review','talkback-and-accessibility-human-review',
  'independent-merge-approval','separate-deployment-approval',
  'separate-publication-approval','certified-main-immutable-artifact',
]);
const ROLES=['release-operator','independent-evidence-auditor'];
const PIN_FIELDS=['witnessId','role','spkiDerBase64','sha256Pin'];
const SIGN_FIELDS=['witnessId','role','signatureBase64'];
const RECORD_FIELDS=['schemaVersion','sourceCommit','handoffDigestSha256','releaseZipSha256',
  'originalSiteUrl','decision','nonce','previousSequence','previousDigest',
  'gateStates','issuedAt','expiresAt','signatures'];
function signedPayload(rec) {
  strictObject(rec,RECORD_FIELDS);
  const {signatures,...body}=rec;
  return Buffer.from('MDD-P19-OPERATOR-HOLD-V1\n'+canonical(body));
}
export function custodyDigest(rec) {
  return createHash('sha256').update(signedPayload(rec)).digest('hex');
}
/** Re-evaluate actual ZIP bytes and witnessed receipts before accepting an
 * operator HOLD packet. A passing packet cannot become release authorization. */
export function inspectP19Decision({
  expectedSha,p18Input,operatorRecord,
  externalOperatorPins,externallyTrustedPriorSequence,
  externallyTrustedPriorDigest,previouslyUsedDecisionNonces,currentTime,
}) {
  assert.match(expectedSha,SHA);
  const source=inspectIndependentHandoff({...p18Input,expectedSha});
  assert.equal(source.releaseAuthorized,false,'P18 must deny release');
  assert.equal(source.immutableLocalReleaseZipVerified,true);
  strictObject(operatorRecord,RECORD_FIELDS);
  assert.equal(operatorRecord.schemaVersion,1);
  assert.equal(operatorRecord.sourceCommit,expectedSha,'Operator source SHA mismatch');
  assert.equal(operatorRecord.handoffDigestSha256,source.handoffDigestSha256,
    'Operator decision references another evidence handoff');
  assert.equal(operatorRecord.releaseZipSha256,source.releaseZipSha256,
    'Operator decision references another release archive');
  assert.equal(operatorRecord.originalSiteUrl,p18Input.handoff.originalSiteUrl,
    'Operator decision origin mismatch');
  assert.equal(operatorRecord.decision,'HOLD_FOR_INDEPENDENT_REVIEW',
    'Unsupported or executable operator decision');
  assert.match(operatorRecord.nonce,UUID);
  assert.ok(Array.isArray(previouslyUsedDecisionNonces) &&
    previouslyUsedDecisionNonces.length<=10000,'Independent nonce history required');
  const history=new Set();
  for(const nonce of previouslyUsedDecisionNonces){
    assert.match(nonce,UUID);
    assert.ok(!history.has(nonce),'Duplicate externally used nonce');
    history.add(nonce);
  }
  assert.ok(!history.has(operatorRecord.nonce),'Operator decision replayed');
  assert.ok(Number.isSafeInteger(externallyTrustedPriorSequence) &&
    externallyTrustedPriorSequence>=0);
  assert.match(externallyTrustedPriorDigest,HASH);
  assert.equal(operatorRecord.previousSequence,externallyTrustedPriorSequence,
    'Operator custody sequence differs from independently retained checkpoint');
  assert.equal(operatorRecord.previousDigest,externallyTrustedPriorDigest,
    'Operator custody digest differs from independently retained checkpoint');
  const issued=date(operatorRecord.issuedAt),expires=date(operatorRecord.expiresAt),
    now=date(currentTime);
  assert.ok(issued<=now && now<=expires && expires-issued<=3600*1000,
    'Operator decision expired or future');

  assert.ok(Array.isArray(operatorRecord.gateStates) &&
    operatorRecord.gateStates.length===GATES.length,'Missing operator gate statuses');
  const seen=new Set();
  for(const item of operatorRecord.gateStates) {
    strictObject(item,['id','status']);
    assert.ok(GATES.includes(item.id) && !seen.has(item.id),
      'Unknown or duplicate release gate');
    seen.add(item.id);
    assert.ok(['OPEN','BLOCKED'].includes(item.status),
      'Cannot mark missing human gate approved');
  }
  assert.deepEqual([...seen].sort(),[...GATES].sort());
  assert.ok(Array.isArray(externalOperatorPins) && externalOperatorPins.length===2,
    'Independent operator and auditor pins required');
  assert.ok(Array.isArray(operatorRecord.signatures) &&
    operatorRecord.signatures.length===2,'Two operator custody signatures required');
  const pins=new Map(),fingerprints=new Set(),ids=new Set();
  for(const pin of externalOperatorPins) {
    strictObject(pin,PIN_FIELDS);
    assert.ok(typeof pin.witnessId==='string' && /^[a-zA-Z0-9_.-]{2,64}$/.test(pin.witnessId));
    assert.ok(ROLES.includes(pin.role) && !pins.has(pin.role),'Duplicate or invalid pin role');
    assert.ok(!ids.has(pin.witnessId),'Independent signer identities required');
    ids.add(pin.witnessId);
    assert.match(pin.sha256Pin,HASH);
    const der=bytes(pin.spkiDerBase64);
    assert.equal(sha256(der),pin.sha256Pin,'External operator key pin mismatch');
    assert.ok(!fingerprints.has(pin.sha256Pin),'Operator and auditor cannot share one key');
    fingerprints.add(pin.sha256Pin);
    const key=createPublicKey({key:der,format:'der',type:'spki'});
    assert.equal(key.asymmetricKeyType,'ed25519');
    pins.set(pin.role,{id:pin.witnessId,key});
  }
  assert.deepEqual([...pins.keys()].sort(),[...ROLES].sort());
  const seenRoles=new Set(),message=signedPayload(operatorRecord);
  for(const item of operatorRecord.signatures) {
    strictObject(item,SIGN_FIELDS);
    const signer=pins.get(item.role);
    assert.ok(signer && !seenRoles.has(item.role),'Duplicate or unknown signer role');
    assert.equal(item.witnessId,signer.id,'Signer identity differs from independent pin');
    assert.ok(verify(null,message,signer.key,bytes(item.signatureBase64)),
      'Operator custody signature invalid');
    seenRoles.add(item.role);
  }
  assert.deepEqual([...seenRoles].sort(),[...ROLES].sort());
  return {
    sourceCommit:expectedSha,decision:'HOLD_FOR_INDEPENDENT_REVIEW',
    verifiedP18HandoffDigest:source.handoffDigestSha256,
    releaseZipSha256:source.releaseZipSha256,
    custodyRecordDigestSha256:custodyDigest(operatorRecord),
    signedOperatorClaimsVerified:2,
    nextCustodySequence:externallyTrustedPriorSequence+1,
    stillOpenReleaseGates:GATES,
    independentSourceOfOperatorKeysAuthenticated:false,
    previousOperatorCheckpointAuthenticated:false,
    humanDeviceEvidenceActuallyObserved:false,
    originalOriginMigrationAndRestoreActuallyObserved:false,
    exactMainReleaseCertificationEstablished:false,
    releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false,
    publicationAuthorized:false,actionsPerformed:false,
    recoveryPerformed:false,liveDataAccessed:false,
  };
}
export function defaultHoldGates() {
  return GATES.map(id=>({id,status:'OPEN'}));
}
