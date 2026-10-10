import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';

const SHA = /^[0-9a-f]{40}$/, HASH = /^[0-9a-f]{64}$/;
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const REQUIRED_VISUAL_DECISIONS = Object.freeze([
  'capture-recovery-storage-failure.png', 'durable-people-failure.png',
  'durable-categories-failure.png','durable-collections-failure.png',
  'notes-recovery-storage-failure.png','prayer-writing-storage-failure.png',
  'removed-dialog.png','session-answer-recovery-failure.png',
  'reflection-recovery-storage-failure.png',
]);
const SUBJECTS = Object.freeze({
  'visual': {role:'visual-reviewer', allowed:REQUIRED_VISUAL_DECISIONS},
  'android-device': {role:'device-reviewer',allowed:['android-chrome','android-samsung-internet']},
  'accessibility': {role:'device-reviewer',allowed:['android-talkback','keyboard-and-focus','contrast-and-text-200']},
  'migration-backup': {role:'migration-reviewer',allowed:['original-origin-schema-migration','encrypted-off-device-backup-restore']},
  'rollback': {role:'migration-reviewer',allowed:['forward-only-recovery-rehearsal']},
  'operator-merge': {role:'release-operator',allowed:['merge-authorization']},
  'operator-deploy': {role:'release-operator',allowed:['deployment-authorization']},
});
const KEY_FIELDS=['schemaVersion','keyId','spkiDerBase64','sha256Pin','revoked','validFrom','validUntil','authorizedRoles'];
const ATTEST_FIELDS=['schemaVersion','sourceCommit','subjectType','subjectId','evidenceSha256',
  'nonce','decision','reviewerHandle','role','issuedAt','expiresAt','keyId','signatureBase64'];
function exact(obj,keys,name) {
  assert.ok(obj && typeof obj==='object' && !Array.isArray(obj),name+' must be an object');
  assert.deepEqual(Object.keys(obj).filter(key=>!keys.includes(key)),[],name+' contains unexpected/private fields');
}
function date(x) {
  assert.ok(typeof x==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) && Number.isFinite(Date.parse(x)),'Invalid attestation date');
  return Date.parse(x);
}
function b64(x) {
  assert.ok(typeof x==='string' && x.length>0 && x.length<8192 && /^[A-Za-z0-9+/]+={0,2}$/.test(x),'Bad base64');
  const bytes=Buffer.from(x,'base64');
  assert.equal(bytes.toString('base64'),x,'Noncanonical base64');
  return bytes;
}
function canonical(value) {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function attestationPayload(attestation) {
  exact(attestation,ATTEST_FIELDS,'Attestation');
  const {signatureBase64,...unsigned}=attestation;
  return Buffer.from(canonical(unsigned),'utf8');
}
/** Signature validity does not establish independent authority, revocation freshness or a physical test. */
export function inspectSignedAcceptance({
  sourceCommit, trustRoot, attestations, previouslyUsedNonces = [], codeAuthorHandles = [], now,
}) {
  assert.match(sourceCommit,SHA,'Exact source SHA required');
  exact(trustRoot,KEY_FIELDS,'Trust-root metadata');
  assert.equal(trustRoot.schemaVersion,1);
  assert.ok(typeof trustRoot.keyId==='string' && /^[a-zA-Z0-9_.-]{2,64}$/.test(trustRoot.keyId));
  assert.match(trustRoot.sha256Pin,HASH,'External pin required');
  assert.equal(trustRoot.revoked,false,'Revoked trust root');
  assert.ok(Array.isArray(trustRoot.authorizedRoles) && trustRoot.authorizedRoles.length>0 &&
    new Set(trustRoot.authorizedRoles).size===trustRoot.authorizedRoles.length,'Invalid key roles');
  assert.ok(trustRoot.authorizedRoles.every(r=>Object.values(SUBJECTS).some(s=>s.role===r)));
  const current=date(now), start=date(trustRoot.validFrom), end=date(trustRoot.validUntil);
  assert.ok(start<=current && current<=end,'Trust root outside configured validity period');
  const der=b64(trustRoot.spkiDerBase64);
  assert.equal(createHash('sha256').update(der).digest('hex'),trustRoot.sha256Pin,'Trust-root fingerprint mismatch');
  const key=createPublicKey({key:der,format:'der',type:'spki'});
  assert.equal(key.asymmetricKeyType,'ed25519','Only Ed25519 supported');
  assert.ok(Array.isArray(attestations) && attestations.length<=100);
  assert.ok(Array.isArray(previouslyUsedNonces) && previouslyUsedNonces.length<=10000);
  assert.ok(Array.isArray(codeAuthorHandles) && codeAuthorHandles.length<=100);
  const authors=new Set(codeAuthorHandles);
  const nonces=new Set(),previous=new Set(),targets=new Set();
  for(const n of previouslyUsedNonces){assert.match(n,NONCE);assert.ok(!previous.has(n),'Duplicate historical nonce');previous.add(n);}
  const decisions=[];
  for(const a of attestations) {
    attestationPayload(a);
    assert.equal(a.schemaVersion,1);
    assert.equal(a.sourceCommit,sourceCommit,'Stale signed acceptance');
    assert.equal(a.keyId,trustRoot.keyId,'Unknown key ID');
    assert.ok(SUBJECTS[a.subjectType],'Unknown attestation subject');
    const rule=SUBJECTS[a.subjectType];
    assert.ok(rule.allowed.includes(a.subjectId),'Unexpected subject identifier');
    assert.equal(a.role,rule.role,'Role cannot approve this subject');
    assert.ok(trustRoot.authorizedRoles.includes(a.role),'Signer not authorized for claimed role');
    assert.ok(['accept','reject'].includes(a.decision),'Explicit decision required');
    assert.match(a.evidenceSha256,HASH,'Source-bound SHA-256 evidence required');
    assert.match(a.nonce,NONCE,'Random UUIDv4 nonce required');
    assert.ok(!nonces.has(a.nonce) && !previous.has(a.nonce),'Duplicate or replayed nonce');
    nonces.add(a.nonce);
    assert.ok(typeof a.reviewerHandle==='string' && /^[A-Za-z0-9_.-]{2,80}$/.test(a.reviewerHandle));
    assert.ok(!authors.has(a.reviewerHandle),'Code author cannot independently approve this packet');
    const issue=date(a.issuedAt), expiry=date(a.expiresAt);
    assert.ok(issue>=start && expiry<=end && issue<=current && current<=expiry,'Attestation expired, future or outside root validity');
    assert.ok(expiry-issue<=48*3600*1000,'Attestation lifetime too long');
    const target=a.subjectType+'/'+a.subjectId;
    assert.ok(!targets.has(target),'Duplicate subject decisions');
    targets.add(target);
    assert.ok(verify(null,attestationPayload(a),key,b64(a.signatureBase64)),'Bad Ed25519 signature');
    decisions.push({subjectType:a.subjectType,subjectId:a.subjectId,decision:a.decision,evidenceSha256:a.evidenceSha256});
  }
  const visuals=REQUIRED_VISUAL_DECISIONS.filter(id=>!decisions.some(d=>d.subjectType==='visual' &&
    d.subjectId===id && d.decision==='accept'));
  return {
    sourceCommit,verifiedCryptographicSignatures:decisions.length,verifiedSignatureSubjects:decisions,
    requiredVisualDecisionsStillMissing:visuals,
    trustRootProvisionedByIndependentOperator:false,
    revocationStatusIndependentlyFetched:false,
    historyIndependentlyAuthenticated:false,
    evidenceContentIndependentlyVerified:false,
    deviceOrMigrationAcceptanceVerified:false,
    humanReleaseAuthorityEstablished:false,
    releaseAuthorized:false,actionsPerformed:false,
  };
}
