import assert from 'node:assert/strict';
import {createPublicKey,verify} from 'node:crypto';
import {bytes,canonical,date,sha256,strictObject} from '../p16/custody.mjs';
import {verifyExistingOrigin} from '../p10/acceptance.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const NONCE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KINDS=['original-object','source-rights','cdn-rights','pwa-manifest',
  'service-worker','offline-cache'];
const ROLES=['source-custodian','independent-rights-reviewer'];
const MATERIAL_FIELDS=['kind','evidenceSha256','status','sourceCommit'];
const PIN_FIELDS=['role','witnessId','spkiDerBase64','sha256Pin'];
const SIGN_FIELDS=['role','witnessId','signatureBase64'];
const FIELDS=['schemaVersion','sourceCommit','originalSiteUrl','pwaScopeUrl',
  'swScriptUrl','rightsStatus','cdnStatus','materials','priorSequence','priorDigest',
  'sequence','nonce','issuedAt','expiresAt','disposition','signatures'];
const allowed=['REVIEW_PENDING','REJECTED'];
function signable(record) {
  strictObject(record,FIELDS);
  const {signatures,...body}=record;
  return Buffer.from('MDD-P22-SOURCE-CUSTODY-V1\n'+canonical(body));
}
/** Verify offline source/object/rights/CDN/PWA escrow signatures under externally pinned public keys.
 * No signature can establish independent rights approval, physical testing, or release authority.
 */
export function inspectSourceCustody({
  sourceCommit,originalSiteUrl,hostPacket,escrow,externalPins,
  trustedPreviousSequence,trustedPreviousDigest,previouslyUsedEscrowNonces,currentTime,
}) {
  assert.match(sourceCommit,SHA);
  verifyExistingOrigin(originalSiteUrl,hostPacket.originalSiteUrl);
  verifyExistingOrigin(originalSiteUrl,hostPacket.pwaScopeUrl);
  strictObject(escrow,FIELDS);
  assert.equal(escrow.schemaVersion,1);
  assert.equal(escrow.sourceCommit,sourceCommit,'Escrow source SHA mismatch');
  verifyExistingOrigin(originalSiteUrl,escrow.originalSiteUrl);
  verifyExistingOrigin(originalSiteUrl,escrow.pwaScopeUrl);
  assert.equal(escrow.swScriptUrl,hostPacket.swScriptUrl,'Service-worker identity changed');
  assert.ok(allowed.includes(escrow.rightsStatus) &&
    allowed.includes(escrow.cdnStatus),'Rights/CDN cannot be self-approved');
  assert.equal(escrow.rightsStatus,hostPacket.rightsReviewStatus==='REJECTED'?'REJECTED':'REVIEW_PENDING',
    'Rights intake status differs from P21');
  assert.equal(escrow.cdnStatus,hostPacket.cdnReviewStatus==='REJECTED'?'REJECTED':'REVIEW_PENDING',
    'CDN review status differs from P21');
  assert.equal(escrow.disposition,'ESCROW_ONLY_NO_RELEASE','Executable escrow disposition prohibited');
  assert.ok(Array.isArray(escrow.materials)&&escrow.materials.length===6,
    'Six bounded material evidence entries required');
  const expected={
    'original-object':hostPacket.originalHostEvidenceSha256,
    'source-rights':hostPacket.sourceRightsEvidenceSha256,
    'cdn-rights':hostPacket.cdnEvidenceSha256,
    'pwa-manifest':hostPacket.pwaManifestSha256,
    'service-worker':hostPacket.serviceWorkerSha256,
    'offline-cache':hostPacket.originalHostEvidenceSha256,
  },seen=new Set();
  for(const row of escrow.materials) {
    strictObject(row,MATERIAL_FIELDS);
    assert.ok(KINDS.includes(row.kind)&&!seen.has(row.kind),
      'Duplicate/unknown source material');
    seen.add(row.kind);
    assert.equal(row.sourceCommit,sourceCommit,'Source material from another commit');
    assert.match(row.evidenceSha256,HASH);
    assert.equal(row.evidenceSha256,expected[row.kind],
      'Source/rights/CDN/PWA evidence differs from original-host packet');
    assert.ok(allowed.includes(row.status),'Evidence may not self-approve');
  }
  assert.deepEqual([...seen].sort(),[...KINDS].sort());
  assert.ok(Number.isSafeInteger(trustedPreviousSequence)&&trustedPreviousSequence>=0);
  assert.match(trustedPreviousDigest,HASH,'Independently kept escrow digest required');
  assert.equal(escrow.priorSequence,trustedPreviousSequence,'Escrow sequence anchor differs');
  assert.equal(escrow.priorDigest,trustedPreviousDigest,'Escrow history fork/replay');
  assert.equal(escrow.sequence,trustedPreviousSequence+1,'Escrow sequence must increase exactly once');
  assert.match(escrow.nonce,NONCE);
  assert.ok(Array.isArray(previouslyUsedEscrowNonces)&&previouslyUsedEscrowNonces.length<=10000);
  const nonces=new Set();
  for(const n of previouslyUsedEscrowNonces){
    assert.match(n,NONCE);assert.ok(!nonces.has(n),'Duplicate retained escrow nonce');nonces.add(n);
  }
  assert.ok(!nonces.has(escrow.nonce),'Escrow nonce already used');
  const issued=date(escrow.issuedAt),expires=date(escrow.expiresAt),now=date(currentTime);
  assert.ok(issued<=now&&now<=expires&&expires-issued<=60*60*1000,
    'Escrow evidence expired or future');
  assert.ok(Array.isArray(externalPins)&&externalPins.length===2,
    'Distinct independent custody and rights signer pins required');
  assert.ok(Array.isArray(escrow.signatures)&&escrow.signatures.length===2,
    'Two custody signatures required');
  const pins=new Map(),fingerprints=new Set(),identities=new Set();
  for(const p of externalPins) {
    strictObject(p,PIN_FIELDS);
    assert.ok(ROLES.includes(p.role)&&!pins.has(p.role),'Duplicate/unknown custody signer role');
    assert.ok(typeof p.witnessId==='string'&&/^[a-zA-Z0-9_.-]{2,64}$/.test(p.witnessId));
    assert.ok(!identities.has(p.witnessId),'Escrow signer identities must differ');
    identities.add(p.witnessId);
    assert.match(p.sha256Pin,HASH);
    const der=bytes(p.spkiDerBase64);
    assert.equal(sha256(der),p.sha256Pin,'Escrow public pin mismatch');
    assert.ok(!fingerprints.has(p.sha256Pin),'Custody/rights keys must be distinct');
    fingerprints.add(p.sha256Pin);
    const key=createPublicKey({key:der,format:'der',type:'spki'});
    assert.equal(key.asymmetricKeyType,'ed25519');
    pins.set(p.role,{id:p.witnessId,key});
  }
  assert.deepEqual([...pins.keys()].sort(),[...ROLES].sort());
  const roles=new Set(),msg=signable(escrow);
  for(const s of escrow.signatures) {
    strictObject(s,SIGN_FIELDS);
    const signer=pins.get(s.role);
    assert.ok(signer&&!roles.has(s.role),'Duplicate or unsupported signer signature');
    roles.add(s.role);
    assert.equal(s.witnessId,signer.id,'Escrow signer is not separately pinned identity');
    assert.ok(verify(null,msg,signer.key,bytes(s.signatureBase64)),
      'Signed escrow payload changed');
  }
  assert.deepEqual([...roles].sort(),[...ROLES].sort());
  return {
    sourceCommit,sourceEscrowDigestSha256:sha256(msg),
    verifiedEscrowSignatures:2,escrowSequence:escrow.sequence,
    originalHostAndRightsClaimsBound:true,
    rightsIndependentlyLicensed:false,cdnRightsApproved:false,
    independentlyAuthenticatedCustody:false,
    actualOfflinePwaTestPerformed:false,releaseAuthorized:false,
  };
}
