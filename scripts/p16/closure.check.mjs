import * as fs from 'node:fs';
import * as pathNode from 'node:path';
import * as os from 'node:os';
import * as child from 'node:child_process';
import * as urlNode from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, sha256, verifyCustody } from './custody.mjs';
import { recordDigest, verifyReceiptHistory } from './receipt-history.mjs';
import { inspectDeviceClaims, inspectOperatorClosure } from './operator.mjs';

const sha='a'.repeat(40), other='b'.repeat(40), dig='c'.repeat(64);
const now='2026-10-10T08:00:00Z',zero='0'.repeat(64);
const custody=generateKeyPairSync('ed25519'),signer=generateKeyPairSync('ed25519');
const publicDer=key=>key.export({type:'spki',format:'der'});
const rootDer=publicDer(custody.publicKey),signerDer=publicDer(signer.publicKey);
const rootPin=sha256(rootDer);
const sealed=(body,key)=>({...body,signatureBase64:sign(null,Buffer.from(canonical(body)),key).toString('base64')});
function manifest(keys=[{keyId:'test-signer',spkiDerBase64:signerDer.toString('base64'),
  sha256Pin:sha256(signerDer),
  authorizedRoles:['visual-reviewer','device-reviewer','migration-reviewer','release-operator']}],revoked=[]) {
 return sealed({schemaVersion:1,sourceCommit:sha,rootKeyId:'test-custodian',revision:2,
   issuedAt:'2026-10-10T07:00:00Z',expiresAt:'2026-10-10T09:00:00Z',
   keys,revokedKeyIds:revoked},custody.privateKey);
}
const uuid0='123e4567-e89b-42d3-a456-426614174000',uuid1='123e4567-e89b-42d3-a456-426614174001';
function receipt({subjectType='visual',subjectId='capture-recovery-storage-failure.png',
  role='visual-reviewer',nonce=uuid0,decision='accept'}={}) {
 return sealed({schemaVersion:1,sourceCommit:sha,subjectType,subjectId,evidenceSha256:dig,
  nonce,decision,reviewerHandle:'independent-fixture',role,
  issuedAt:'2026-10-10T07:10:00Z',expiresAt:'2026-10-10T08:30:00Z',
  keyId:'test-signer'},signer.privateKey);
}
function records(receipts=[receipt()]) {
 let previousDigest=zero;
 return receipts.map((r,i)=>{
   const rec={sequence:i+1,previousDigest,receipt:r,digest:zero};
   rec.digest=recordDigest(rec);previousDigest=rec.digest;return rec;
 });
}
function evidence(recs=records()) {
 const c=sealed({schemaVersion:1,sourceCommit:sha,rootKeyId:'test-custodian',
  fromSequence:0,priorDigest:zero,finalSequence:recs.length,
  finalDigest:recs[recs.length-1].digest,
  issuedAt:'2026-10-10T07:45:00Z',expiresAt:'2026-10-10T08:15:00Z'},custody.privateKey);
 return {sourceCommit:sha,rootPublicSpkiDerBase64:rootDer.toString('base64'),
   expectedRootSha256:rootPin,minimumTrustedRevision:2,manifest:manifest(),
   trustedPreviousAnchor:{sequence:0,digest:zero},records:recs,checkpoint:c,
   previouslyUsedNonces:[],codeAuthorHandles:['source-author'],currentTime:now};
}
const checked=p=>verifyReceiptHistory(p);
function recovery(){
 const old='https://original.example.test/devotion/';
 return {sourceCommit:sha,existingSiteUrl:old,candidateSiteUrl:old,
  installedSchema:3,targetSchema:3,backupFormat:'portable-v1-encrypted',
  backupOffDeviceEncrypted:true,procedure:'fresh-compatible-profile-restore',
  destructiveSteps:[],evidenceSha256:dig};
}
function closure(r=evidence()){
 const verifiedHistory=checked(r);
 return {sourceCommit:sha,originalSiteUrl:'https://original.example.test/devotion/',
  archiveEvidence:{sourceCommit:sha,archiveSha256:dig,localArtifactHashesVerified:true,
    runId:111,artifactId:222},
  verifiedHistory,historyRecords:r.records,deviceClaims:[],recoveryPlan:recovery()};
}
test('independently supplied pin validates custody signature but never proves provenance authority',()=>{
 const c=verifyCustody(evidence());
 assert.equal(c.custodyManifestSignatureVerified,true);
 assert.equal(c.activeSignerRoots.length,1);
 assert.equal(c.trustPinIndependentlyAuthenticated,false);
 assert.equal(c.releaseAuthorized,false);
});
test('rejects forged root, manifest modifications and unknown metadata',()=>{
 const a=evidence();a.expectedRootSha256='e'.repeat(64);
 assert.throws(()=>verifyCustody(a),/External custody pin mismatch/);
 const b=evidence();b.manifest.revision=999;
 assert.throws(()=>verifyCustody(b),/Custody signature invalid/);
 const c=evidence();c.manifest.prayerText='PRIVATE';
 assert.throws(()=>verifyCustody(c),/private metadata/);
});
test('rejects stale custody manifest, expired status and duplicated/unknown revoked keys',()=>{
 const a=evidence();a.currentTime='2026-10-12T12:00:00Z';
 assert.throws(()=>verifyCustody(a),/Stale or future/);
 const b=evidence();b.manifest=manifest(undefined,['test-signer','test-signer']);
 assert.throws(()=>verifyCustody(b),/Duplicate revocation ID/);
 const c=evidence();c.manifest=manifest(undefined,['unknown-key']);
 assert.throws(()=>verifyCustody(c),/Revocation references unknown/);
});
test('signed revocation removes signing key and prevents acceptance',()=>{
 const a=evidence();a.manifest=manifest(undefined,['test-signer']);
 assert.equal(verifyCustody(a).activeSignerRoots.length,0);
 assert.throws(()=>checked(a),/unknown or revoked/);
});
test('valid append-only chain verifies receipt and checkpoint but cannot authorize release',()=>{
 const r=checked(evidence());
 assert.equal(r.verifiedReceiptSignatures,1);
 assert.equal(r.checkpointSignatureVerified,true);
 assert.equal(r.sequence,1);assert.equal(r.releaseAuthorized,false);
 assert.deepEqual(r.acceptedVisualClaims,['capture-recovery-storage-failure.png']);
 assert.equal(r.externalHistoryAnchorIndependentlyAuthenticated,false);
});
test('rejects wrong external last checkpoint, repeated sequence and digest mismatch',()=>{
 const a=evidence();a.trustedPreviousAnchor.digest='f'.repeat(64);
 assert.throws(()=>checked(a),/history fork or replay/);
 const b=evidence();b.records[0].sequence=2;
 assert.throws(()=>checked(b),/sequence skipped/);
 const c=evidence();c.records[0].digest='f'.repeat(64);
 assert.throws(()=>checked(c),/chain digest mismatch/);
});
test('rejects altered checkpoint, wrong source, replay and expired receipts',()=>{
 const a=evidence();a.checkpoint.finalDigest='e'.repeat(64);
 assert.throws(()=>checked(a),/terminal digest changed/);
 const b=evidence();b.sourceCommit=other;
 assert.throws(()=>checked(b),/another SHA/);
 const c=evidence();c.previouslyUsedNonces=[uuid0];
 assert.throws(()=>checked(c),/nonce replayed/);
 const d=evidence();d.currentTime='2026-10-10T08:35:00Z';
 assert.throws(()=>checked(d),/expired, future/);
});
test('invalid checkpoint signature and wrong signing role or code author fail',()=>{
 const a=evidence();a.checkpoint.signatureBase64='AAAA';
 assert.throws(()=>checked(a),/Checkpoint signature invalid/);
 const b=evidence();b.records=records([receipt({role:'device-reviewer'})]);
 b.checkpoint=evidence(b.records).checkpoint;
 assert.throws(()=>checked(b),/Role cannot approve/);
 const c=evidence();c.codeAuthorHandles=['independent-fixture'];
 assert.throws(()=>checked(c),/Code author cannot/);
});
test('distinct signed visual and physical Android claims are correlated, never verified as human evidence',()=>{
 const r=evidence(records([
  receipt(),receipt({subjectType:'android-device',subjectId:'android-chrome',
    role:'device-reviewer',nonce:uuid1}),
 ]));
 const report=checked(r);
 assert.equal(report.verifiedReceiptSignatures,2);
 assert.deepEqual(report.acceptedDeviceOrAccessibilityClaims,['android-chrome']);
 const d=inspectDeviceClaims({sourceCommit:sha,historyRecords:r.records,deviceClaims:[{
   sourceCommit:sha,subjectId:'android-chrome',scenarioIds:['offline-cold-start','ime-writing'],
   evidenceSha256:dig,observerHandle:'independent-fixture',claimedPhysical:true,
 }]});
 assert.equal(d.realDeviceIndependentlyVerified,false);
 assert.equal(d.claims['android-chrome'].missingScenarioClaims.length,3);
});
test('physical-device attestation hash, observer, role and private details must match',()=>{
 const r=records([receipt({subjectType:'android-device',subjectId:'android-chrome',
   role:'device-reviewer'})]);
 const base={sourceCommit:sha,historyRecords:r,deviceClaims:[{sourceCommit:sha,
   subjectId:'android-chrome',scenarioIds:['offline-cold-start'],
   evidenceSha256:dig,observerHandle:'independent-fixture',claimedPhysical:true}]};
 const a=structuredClone(base);a.deviceClaims[0].evidenceSha256='f'.repeat(64);
 assert.throws(()=>inspectDeviceClaims(a),/Evidence hash differs/);
 const b=structuredClone(base);b.deviceClaims[0].observerHandle='another';
 assert.throws(()=>inspectDeviceClaims(b),/Observer differs/);
 const c=structuredClone(base);c.deviceClaims[0].deviceId='PRIVATE';
 assert.throws(()=>inspectDeviceClaims(c),/private metadata/);
 const d=structuredClone(base);d.deviceClaims[0].claimedPhysical=false;
 assert.throws(()=>inspectDeviceClaims(d),/Emulator evidence/);
});
test('controlled operator output is blocked even when signatures and archive claims are valid',()=>{
 const x=inspectOperatorClosure(closure());
 assert.equal(x.mode,'nondeploying-operator-evidence-rehearsal');
 assert.equal(x.releaseAuthorized,false);assert.equal(x.deploymentPerformed,false);
 assert.equal(x.liveDataAccessed,false);assert.equal(x.missingVisualClaims.length,8);
 assert.equal(x.releaseGateClaimsMissing.length,13);
});
test('operator rehearsal forbids origin moves, schema downgrades and stale archive',()=>{
 const a=closure();a.originalSiteUrl='https://new.example.test/devotion/';
 assert.throws(()=>inspectOperatorClosure(a),/across origins/);
 const b=closure();b.recoveryPlan.targetSchema=2;
 assert.throws(()=>inspectOperatorClosure(b),/No database downgrade/);
 const c=closure();c.archiveEvidence.sourceCommit=other;
 assert.throws(()=>inspectOperatorClosure(c),/Archive evidence stale/);
});


test('CLI is never a release-success exit and rejects missing external trust roots without leaking paths',()=>{
 const { mkdtempSync,writeFileSync,rmSync }=fs;

 const {join}=pathNode,{tmpdir}=os,{spawnSync}=child;

 const {fileURLToPath}=urlNode;

 const dir=mkdtempSync(join(tmpdir(),'mdd-p16-'));
 try {
   const path=join(dir,'evidence.json'),sample=evidence();
   writeFileSync(path,JSON.stringify({...sample,privateJournal:'NEVER_LOG_PRIVATE_PRAYER'}));
   const cli=fileURLToPath(new URL('./closure-cli.mjs',import.meta.url));
   const command=(env)=>spawnSync(process.execPath,[cli,'history',path,sha,now],
     {encoding:'utf8',env:{...process.env,...env}});
   const missing=command({});
   assert.equal(missing.status,4);
   const malformed=command({MDD_CUSTODY_ROOT_SHA256:rootPin,
     MDD_TRUSTED_LEDGER_DIGEST:zero,MDD_TRUSTED_LEDGER_SEQUENCE:'0',MDD_MIN_TRUSTED_CUSTODY_REVISION:'2'});
   assert.equal(malformed.status,4);
   assert.ok(!malformed.stderr.includes('NEVER_LOG_PRIVATE_PRAYER'));
   assert.ok(!malformed.stderr.includes(dir));
   writeFileSync(path,JSON.stringify({
     sourceCommit:sha,rootPublicSpkiDerBase64:sample.rootPublicSpkiDerBase64,
     manifest:sample.manifest,records:sample.records,checkpoint:sample.checkpoint,
     previouslyUsedNonces:[],codeAuthorHandles:['source-author'],
   }));
   const valid=command({MDD_CUSTODY_ROOT_SHA256:rootPin,
     MDD_TRUSTED_LEDGER_DIGEST:zero,MDD_TRUSTED_LEDGER_SEQUENCE:'0',MDD_MIN_TRUSTED_CUSTODY_REVISION:'2'});
   assert.equal(valid.status,3,valid.stderr);
   assert.equal(JSON.parse(valid.stdout).releaseAuthorized,false);
   assert.ok(!valid.stdout.includes('independent-fixture'));
   const replay=command({MDD_CUSTODY_ROOT_SHA256:rootPin,
     MDD_TRUSTED_LEDGER_DIGEST:'f'.repeat(64),MDD_TRUSTED_LEDGER_SEQUENCE:'0',MDD_MIN_TRUSTED_CUSTODY_REVISION:'2'});
   assert.equal(replay.status,4,'Wrong trusted previous checkpoint must not pass');
 } finally {rmSync(dir,{recursive:true,force:true})}
});


test('externally pinned newer revocation revision prevents older signed but unrevoked roster replay',()=>{
 const old=evidence();
 old.minimumTrustedRevision=3;
 assert.throws(()=>verifyCustody(old),/revocation-state rollback/);
 assert.throws(()=>checked(old),/revocation-state rollback/);
});


test('operator cannot substitute a different receipt batch after checkpoint verification',()=>{
 const a=closure();
 a.historyRecords=records([receipt({decision:'reject'})]);
 assert.throws(()=>inspectOperatorClosure(a),/Operator receipt chain differs from verified checkpoint/);
 const b=closure();b.historyRecords[0].digest='f'.repeat(64);
 assert.throws(()=>inspectOperatorClosure(b),/Operator receipt source digest mismatch/);
 const c=closure();c.historyRecords=[];
 assert.throws(()=>inspectOperatorClosure(c),/Operator receipt batch missing/);
});
