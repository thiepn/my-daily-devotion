import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonical,sha256} from '../p16/custody.mjs';
import {recordDigest} from '../p16/receipt-history.mjs';
import {inspectWitnessedAnchor} from './witnessed-anchor.mjs';
import {inspectP17Closure} from './closure.mjs';

const sourceCommit='a'.repeat(40),digest='b'.repeat(64),zero='0'.repeat(64);
const now='2026-10-10T13:30:00Z';
const root=generateKeyPairSync('ed25519'),review=generateKeyPairSync('ed25519');
const w1=generateKeyPairSync('ed25519'),w2=generateKeyPairSync('ed25519');
const der=k=>k.export({format:'der',type:'spki'});
const rootDer=der(root.publicKey),reviewDer=der(review.publicKey);
const uuid=i=>'123e4567-e89b-42d3-a456-'+String(426614174000+i);
const signed=(body,privateKey)=>({...body,signatureBase64:
  sign(null,Buffer.from(canonical(body)),privateKey).toString('base64')});
function signer(){
 return {keyId:'test-signing-key',spkiDerBase64:reviewDer.toString('base64'),
   sha256Pin:sha256(reviewDer),
   authorizedRoles:['visual-reviewer','device-reviewer','migration-reviewer']};
}
function roster(){
 return signed({schemaVersion:1,sourceCommit,rootKeyId:'test-root',
   revision:2,issuedAt:'2026-10-10T13:00:00Z',
   expiresAt:'2026-10-10T14:00:00Z',keys:[signer()],revokedKeyIds:[]},root.privateKey);
}
const pins=()=>[
  {witnessId:'custody-observer-fixture',role:'custody-witness',
    spkiDerBase64:der(w1.publicKey).toString('base64'),sha256Pin:sha256(der(w1.publicKey))},
  {witnessId:'recovery-observer-fixture',role:'recovery-witness',
    spkiDerBase64:der(w2.publicKey).toString('base64'),sha256Pin:sha256(der(w2.publicKey))},
];
function anchor(){
 const data={schemaVersion:1,sourceCommit,custodyRootSha256:sha256(rootDer),
   minimumCustodyRevision:2,ledgerSequence:0,ledgerDigest:zero,
   issuedAt:'2026-10-10T13:00:00Z',expiresAt:'2026-10-10T13:45:00Z',
   nonce:uuid(100)};
 const payload=Buffer.from('MDD-P17-WITNESSED-ANCHOR-V1\n'+
   JSON.stringify(Object.keys(data).sort().map(k=>[k,data[k]])));
 return {...data,signatures:pins().map((p,i)=>({witnessId:p.witnessId,role:p.role,
   signatureBase64:sign(null,payload,[w1,w2][i].privateKey).toString('base64')}))};
}
function receipt(subjectType='visual',subjectId='capture-recovery-storage-failure.png',
 nonce=uuid(0),hash=digest) {
 const roles={visual:'visual-reviewer','android-device':'device-reviewer',
   accessibility:'device-reviewer','migration-backup':'migration-reviewer'};
 return signed({schemaVersion:1,sourceCommit,subjectType,subjectId,evidenceSha256:hash,nonce,
   decision:'accept',reviewerHandle:'independent-fixture',role:roles[subjectType],
   issuedAt:'2026-10-10T13:05:00Z',expiresAt:'2026-10-10T13:40:00Z',
   keyId:'test-signing-key'},review.privateKey);
}
function makeRecords(recs=[receipt()]){
 let prior=zero;
 return recs.map((r,i)=>{
   const o={sequence:i+1,previousDigest:prior,receipt:r,digest:zero};
   o.digest=recordDigest(o);prior=o.digest;return o;
 });
}
function checkpoint(records){
 return signed({schemaVersion:1,sourceCommit,rootKeyId:'test-root',
   fromSequence:0,priorDigest:zero,finalSequence:records.length,
   finalDigest:records.at(-1).digest,
   issuedAt:'2026-10-10T13:15:00Z',expiresAt:'2026-10-10T13:40:00Z'},root.privateKey);
}
function base(receipts=[receipt()]) {
 const records=makeRecords(receipts),site='https://original.example.test/devotion/';
 return {sourceCommit,originalSiteUrl:site,anchor:anchor(),externalWitnessPins:pins(),
   previouslyAcceptedNonceIds:[],minimumAcceptedSequence:0,minimumAcceptedRevision:2,
   rootPublicSpkiDerBase64:rootDer.toString('base64'),manifest:roster(),
   records,checkpoint:checkpoint(records),previouslyUsedNonces:[],
   codeAuthorHandles:['code-author'],currentTime:now,deviceClaims:[],devicePackets:[],
   migrationPacket:null,recoveryPlan:{sourceCommit,existingSiteUrl:site,candidateSiteUrl:site,
     installedSchema:3,targetSchema:3,backupFormat:'portable-v1-encrypted',
     backupOffDeviceEncrypted:true,procedure:'fresh-compatible-profile-restore',
     destructiveSteps:[],evidenceSha256:digest},
   archiveEvidence:{sourceCommit,archiveSha256:digest,
     localArtifactHashesVerified:true,runId:123,artifactId:456},
 };
}
test('independent witness pins and signatures verify, but never authorize an actual release',()=>{
 const b=base();
 const a=inspectWitnessedAnchor(b);
 assert.equal(a.witnessedSignaturesVerified,2);
 assert.equal(a.independentlyAuthenticatedSourceOfWitnessPins,false);
 const r=inspectP17Closure(b);
 assert.equal(r.appendedReceipts,1);
 assert.equal(r.missingOriginalVisualDecisions.length,8);
 assert.equal(r.releaseAuthorized,false);
 assert.equal(r.deployPerformed,false);assert.equal(r.liveUserDataAccessed,false);
});
test('rejects altered anchor, wrong source SHA and signature substitution',()=>{
 const a=base();a.anchor.ledgerDigest='f'.repeat(64);
 assert.throws(()=>inspectP17Closure(a),/Witness anchor signature invalid/);
 const b=base();b.anchor.sourceCommit='c'.repeat(40);
 assert.throws(()=>inspectP17Closure(b),/Anchor source SHA mismatch/);
 const c=base();c.anchor.signatures[0].signatureBase64=c.anchor.signatures[1].signatureBase64;
 assert.throws(()=>inspectP17Closure(c),/Witness anchor signature invalid/);
});
test('two independently pinned witness roles and distinct identities required',()=>{
 const a=base();a.externalWitnessPins[1].role='custody-witness';
 assert.throws(()=>inspectP17Closure(a),/Duplicate witness role/);
 const b=base();b.externalWitnessPins[1].witnessId=b.externalWitnessPins[0].witnessId;
 assert.throws(()=>inspectP17Closure(b),/Witness identities must differ/);
 const c=base();c.externalWitnessPins[0].sha256Pin='d'.repeat(64);
 assert.throws(()=>inspectP17Closure(c),/External witness public-key pin mismatch/);
});
test('replayed witness nonce and lower trusted sequence or custody revision are rejected',()=>{
 const a=base();a.previouslyAcceptedNonceIds=[a.anchor.nonce];
 assert.throws(()=>inspectP17Closure(a),/nonce replayed/);
 const b=base();b.minimumAcceptedSequence=1;
 assert.throws(()=>inspectP17Closure(b),/ledger sequence rollback/);
 const c=base();c.minimumAcceptedRevision=3;
 assert.throws(()=>inspectP17Closure(c),/custody revision rollback/);
});
test('rejects expired witness signatures and private metadata fields',()=>{
 const a=base();a.currentTime='2026-10-10T13:50:00Z';
 assert.throws(()=>inspectP17Closure(a),/expired or future/);
 const b=base();b.anchor.prayerText='PRIVATE';
 assert.throws(()=>inspectP17Closure(b),/private metadata/);
});
test('signed receipt history cannot reuse wrong ledger digest or change checkpoint',()=>{
 const a=base();a.records[0].previousDigest='f'.repeat(64);
 assert.throws(()=>inspectP17Closure(a),/Ledger history fork or replay/);
 const b=base();b.checkpoint.finalDigest='f'.repeat(64);
 assert.throws(()=>inspectP17Closure(b),/Checkpoint terminal digest changed/);
});
test('physical Android metadata is matched to attested exact SHA/evidence but unverified on hardware',()=>{
 const b=base([receipt(),receipt('android-device','android-chrome',uuid(1))]);
 b.deviceClaims=[{sourceCommit,subjectId:'android-chrome',
   scenarioIds:['offline-cold-start','ime-writing'],evidenceSha256:digest,
   observerHandle:'independent-fixture',claimedPhysical:true}];
 b.devicePackets=[{sourceCommit,kind:'android-device',subjectId:'android-chrome',
   evidenceSha256:digest,origin:'controlled-physical-review-packet',scenarioCount:2,
   operatorReviewedClaim:true}];
 const r=inspectP17Closure(b);
 assert.equal(r.devicePacketScenarioClaims['android-chrome'],2);
 assert.equal(r.humanHardwareReviewVerified,false);
 assert.equal(r.releaseAuthorized,false);
});
test('device packet must match signer/hash, scenario count and valid source',()=>{
 const b=base([receipt(),receipt('android-device','android-chrome',uuid(1))]);
 b.deviceClaims=[{sourceCommit,subjectId:'android-chrome',scenarioIds:['ime-writing'],
   evidenceSha256:digest,observerHandle:'independent-fixture',claimedPhysical:true}];
 b.devicePackets=[{sourceCommit,kind:'android-device',subjectId:'android-chrome',
   evidenceSha256:digest,origin:'synthetic-device-packet',scenarioCount:1,
   operatorReviewedClaim:false}];
 const a=structuredClone(b);a.devicePackets[0].evidenceSha256='f'.repeat(64);
 assert.throws(()=>inspectP17Closure(a),/attested evidence hash/);
 const c=structuredClone(b);c.devicePackets[0].scenarioCount=2;
 assert.throws(()=>inspectP17Closure(c),/scenario count/);
 const d=structuredClone(b);d.devicePackets[0].deviceId='PRIVATE';
 assert.throws(()=>inspectP17Closure(d),/private metadata/);
});
test('disposable original-origin migration and encrypted backup claims are separately signed',()=>{
 const b=base([receipt(),
   receipt('migration-backup','original-origin-schema-migration',uuid(1)),
   receipt('migration-backup','encrypted-off-device-backup-restore',uuid(2))]);
 b.migrationPacket={sourceCommit,originalSiteUrl:b.originalSiteUrl,candidateSiteUrl:b.originalSiteUrl,
   schemaBefore:1,schemaAfter:3,backupFormat:'portable-v1-encrypted',
   offDeviceEncrypted:true,migrationEvidenceSha256:digest,restoreEvidenceSha256:digest,
   profileKind:'disposable',claimedRestored:true};
 const r=inspectP17Closure(b);
 assert.equal(r.migrationBackupClaims.supplied,true);
 assert.equal(r.migrationBackupClaims.independentlyVerified,false);
 assert.equal(r.originalSiteMigrationPhysicallyVerified,false);
});
test('rejects origin moves, unencrypted backup, wrong migration hash, real-profile test',()=>{
 const b=base([receipt(),
   receipt('migration-backup','original-origin-schema-migration',uuid(1)),
   receipt('migration-backup','encrypted-off-device-backup-restore',uuid(2))]);
 b.migrationPacket={sourceCommit,originalSiteUrl:b.originalSiteUrl,candidateSiteUrl:b.originalSiteUrl,
   schemaBefore:1,schemaAfter:3,backupFormat:'portable-v1-encrypted',offDeviceEncrypted:true,
   migrationEvidenceSha256:digest,restoreEvidenceSha256:digest,
   profileKind:'disposable',claimedRestored:true};
 const a=structuredClone(b);a.migrationPacket.candidateSiteUrl='https://new.example.test/devotion/';
 assert.throws(()=>inspectP17Closure(a),/across origins/);
 const c=structuredClone(b);c.migrationPacket.offDeviceEncrypted=false;
 assert.throws(()=>inspectP17Closure(c),/true/);
 const d=structuredClone(b);d.migrationPacket.migrationEvidenceSha256='f'.repeat(64);
 assert.throws(()=>inspectP17Closure(d),/differs from signed receipt/);
 const e=structuredClone(b);e.migrationPacket.profileKind='real-user-profile';
 assert.throws(()=>inspectP17Closure(e),/Only disposable/);
});
test('recovery never permits downgrade, destructive action or changed original site',()=>{
 const a=base();a.recoveryPlan.targetSchema=1;
 assert.throws(()=>inspectP17Closure(a),/No database downgrade/);
 const b=base();b.recoveryPlan.destructiveSteps=['clear-site-data'];
 assert.throws(()=>inspectP17Closure(b),/No destructive recovery/);
 const c=base();c.originalSiteUrl='https://different.example.test/devotion/';
 assert.throws(()=>inspectP17Closure(c),/across origins/);
});
test('unknown physical device packet and credential-bearing URLs are rejected',()=>{
 const a=base();a.devicePackets=[{sourceCommit,kind:'android-device',subjectId:'unknown',
   evidenceSha256:digest,origin:'synthetic-device-packet',scenarioCount:1,
   operatorReviewedClaim:false}];
 assert.throws(()=>inspectP17Closure(a),/no signed attestation/);
 const b=base();b.originalSiteUrl+='?token=do-not-leak';
 assert.throws(()=>inspectP17Closure(b),/query strings or bearer tokens/);
});


test('distinct witness IDs cannot reuse the same public signing key',()=>{
 const a=base();
 a.externalWitnessPins[1].spkiDerBase64=a.externalWitnessPins[0].spkiDerBase64;
 a.externalWitnessPins[1].sha256Pin=a.externalWitnessPins[0].sha256Pin;
 assert.throws(()=>inspectP17Closure(a),/Two independent cryptographic witness keys required/);
});
test('CLI requires out-of-band witness pins and refuses output-as-release success',async()=>{
 const {mkdtempSync,rmSync,writeFileSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const folder=mkdtempSync(join(tmpdir(),'mdd-p17-'));
 try{
   const b=base(),file=join(folder,'private-metadata.json');
   const {externalWitnessPins,previouslyAcceptedNonceIds,
     minimumAcceptedSequence,minimumAcceptedRevision,currentTime,...packet}=b;
   writeFileSync(file,JSON.stringify(packet));
   const cli=fileURLToPath(new URL('./closure-cli.mjs',import.meta.url));
   const run=env=>spawnSync(process.execPath,[cli,'inspect',file,sourceCommit,now],
     {encoding:'utf8',env:{...process.env,...env}});
   const trusted={
     MDD_EXTERNAL_WITNESS_PINS_JSON:JSON.stringify(externalWitnessPins),
     MDD_PREVIOUS_WITNESS_NONCES_JSON:JSON.stringify(previouslyAcceptedNonceIds),
     MDD_MIN_WITNESSED_LEDGER_SEQUENCE:String(minimumAcceptedSequence),
     MDD_MIN_WITNESSED_CUSTODY_REVISION:String(minimumAcceptedRevision),
   };
   const positive=run(trusted);
   assert.equal(positive.status,3,positive.stderr);
   const result=JSON.parse(positive.stdout);
   assert.equal(result.proofChainStructurallyVerified,true);
   assert.equal(result.releaseAuthorized,false);
   assert.equal(result.humanHardwareReviewVerified,false);
   const bad=run({...trusted,MDD_MIN_WITNESSED_CUSTODY_REVISION:'3'});
   assert.equal(bad.status,4);
   writeFileSync(file,JSON.stringify({...packet,privatePrayer:'MY_PRIVATE_PRAYER'}));
   const privateData=run(trusted);
   assert.equal(privateData.status,4);
   assert.ok(!privateData.stderr.includes('MY_PRIVATE_PRAYER'));
   assert.ok(!privateData.stdout.includes('MY_PRIVATE_PRAYER'));
   assert.ok(!privateData.stderr.includes(folder));
 }finally{rmSync(folder,{recursive:true,force:true});}
});
