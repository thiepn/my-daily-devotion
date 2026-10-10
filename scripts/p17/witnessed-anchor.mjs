import assert from 'node:assert/strict';
import {createPublicKey, verify} from 'node:crypto';
import {bytes, date, sha256, signedBody, strictObject} from '../p16/custody.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const ANCHOR_FIELDS=['schemaVersion','sourceCommit','custodyRootSha256','minimumCustodyRevision',
  'ledgerSequence','ledgerDigest','issuedAt','expiresAt','nonce','signatures'];
const SIGNATURE_FIELDS=['witnessId','role','signatureBase64'];
const PIN_FIELDS=['witnessId','role','spkiDerBase64','sha256Pin'];
const NONCE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REQUIRED=['custody-witness','recovery-witness'];
/**
 * A signed witness statement is checked against TWO separately retained public-key pins.
 * It cannot prove how the pins or the journal checkpoint were obtained.
 */
export function inspectWitnessedAnchor({sourceCommit,anchor,externalWitnessPins,
  previouslyAcceptedNonceIds=[],minimumAcceptedSequence=0,
  minimumAcceptedRevision=1,currentTime}) {
  assert.match(sourceCommit,SHA,'Exact source commit required');
  strictObject(anchor,ANCHOR_FIELDS);
  assert.equal(anchor.schemaVersion,1);
  assert.equal(anchor.sourceCommit,sourceCommit,'Anchor source SHA mismatch');
  assert.match(anchor.custodyRootSha256,HASH);
  assert.match(anchor.ledgerDigest,HASH);
  assert.match(anchor.nonce,NONCE);
  assert.ok(Number.isSafeInteger(anchor.minimumCustodyRevision) && anchor.minimumCustodyRevision>0);
  assert.ok(Number.isSafeInteger(anchor.ledgerSequence) && anchor.ledgerSequence>=0);
  assert.ok(Number.isSafeInteger(minimumAcceptedSequence) && minimumAcceptedSequence>=0);
  assert.ok(Number.isSafeInteger(minimumAcceptedRevision) && minimumAcceptedRevision>0);
  assert.ok(anchor.ledgerSequence>=minimumAcceptedSequence,'Witnessed ledger sequence rollback');
  assert.ok(anchor.minimumCustodyRevision>=minimumAcceptedRevision,'Witnessed custody revision rollback');
  assert.ok(Array.isArray(previouslyAcceptedNonceIds) && previouslyAcceptedNonceIds.length<=10000);
  const prior=new Set();
  for(const nonce of previouslyAcceptedNonceIds) {
    assert.match(nonce,NONCE);assert.ok(!prior.has(nonce),'Repeated previously accepted witness nonce');
    prior.add(nonce);
  }
  assert.ok(!prior.has(anchor.nonce),'Witness anchor nonce replayed');
  const issued=date(anchor.issuedAt),expires=date(anchor.expiresAt),now=date(currentTime);
  assert.ok(issued<=now && now<=expires && expires-issued<=3600*1000,'Witnessed anchor expired or future');
  assert.ok(Array.isArray(externalWitnessPins) && externalWitnessPins.length===2,
    'Two distinct externally pinned witness keys required');
  assert.ok(Array.isArray(anchor.signatures) && anchor.signatures.length===2,
    'Two signed witness decisions required');
  const pins=new Map();
  for(const item of externalWitnessPins) {
    strictObject(item,PIN_FIELDS);
    assert.ok(typeof item.witnessId==='string' && /^[a-zA-Z0-9_.-]{2,64}$/.test(item.witnessId));
    assert.ok(REQUIRED.includes(item.role),'Unexpected witness role');
    assert.ok(!pins.has(item.role),'Duplicate witness role');
    assert.match(item.sha256Pin,HASH);
    const der=bytes(item.spkiDerBase64);
    assert.equal(sha256(der),item.sha256Pin,'External witness public-key pin mismatch');
    const key=createPublicKey({key:der,format:'der',type:'spki'});
    assert.equal(key.asymmetricKeyType,'ed25519');
    pins.set(item.role,{id:item.witnessId,key,sha256Pin:item.sha256Pin});
  }
  assert.deepEqual([...pins.keys()].sort(),[...REQUIRED].sort());
  assert.notEqual(pins.get(REQUIRED[0]).id,pins.get(REQUIRED[1]).id,'Witness identities must differ');
  assert.notEqual(pins.get(REQUIRED[0]).sha256Pin,pins.get(REQUIRED[1]).sha256Pin,
    'Two independent cryptographic witness keys required');
  const signed={...anchor};
  delete signed.signatures;
  const payload=Buffer.from('MDD-P17-WITNESSED-ANCHOR-V1\n'+JSON.stringify(Object.keys(signed).sort().map(k=>[k,signed[k]])));
  const seen=new Set();
  for(const signature of anchor.signatures) {
    strictObject(signature,SIGNATURE_FIELDS);
    const pin=pins.get(signature.role);
    assert.ok(pin && !seen.has(signature.role),'Duplicate/unknown signature role');
    seen.add(signature.role);
    assert.equal(signature.witnessId,pin.id,'Witness ID differs from independently pinned identity');
    assert.ok(verify(null,payload,pin.key,bytes(signature.signatureBase64)),
      'Witness anchor signature invalid');
  }
  assert.deepEqual([...seen].sort(),[...REQUIRED].sort());
  return {
    sourceCommit,anchorNonce:anchor.nonce,
    custodyRootSha256:anchor.custodyRootSha256,
    minimumCustodyRevision:anchor.minimumCustodyRevision,
    ledgerSequence:anchor.ledgerSequence,ledgerDigest:anchor.ledgerDigest,
    witnessedSignaturesVerified:2,
    externallyPinnedWitnessesSupplied:true,
    independentlyAuthenticatedSourceOfWitnessPins:false,
    independentlyAuthenticatedPriorHistory:false,
    releaseAuthorized:false,
  };
}
