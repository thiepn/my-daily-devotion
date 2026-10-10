import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {artifactDigest} from '../certification/evidence.mjs';
import {canonical,sha256} from '../p16/custody.mjs';
import {recordDigest} from '../p16/receipt-history.mjs';
import {inspectP19Decision,defaultHoldGates} from '../p19/decision.mjs';
import {inspectIndependentHandoff} from '../p18/handoff.mjs';
import {inspectRotation} from '../p20/rotation.mjs';
import {inspectP20Escalation} from '../p20/escalation.mjs';
import {inspectP21Evidence} from './evidence.mjs';
import {inspectP21OwnerClosure,reviewDecisionDigest} from './owner-closure.mjs';

const sourceCommit='a'.repeat(40),other='b'.repeat(40),zero='0'.repeat(64),digest='c'.repeat(64);
const site='https://original.example.test/devotion/',now='2026-10-10T13:30:00Z';
const keys=[0,1,2,3].map(()=>generateKeyPairSync('ed25519'));
const [root,signer,witness1,witness2]=keys;
const der=k=>k.export({format:'der',type:'spki'});
const signed=(obj,key)=>({...obj,signatureBase64:
  sign(null,Buffer.from(canonical(obj)),key).toString('base64')});
const uuid=i=>'123e4567-e89b-42d3-a456-'+String(426614174000+i);
const shaFile=bytes=>createHash('sha256').update(bytes).digest('hex');
function rootRoster(){
 const signerDer=der(signer.publicKey);
 return signed({schemaVersion:1,sourceCommit,rootKeyId:'fixture-root',revision:2,
   issuedAt:'2026-10-10T13:00:00Z',expiresAt:'2026-10-10T14:00:00Z',
   keys:[{keyId:'fixture-signer',spkiDerBase64:signerDer.toString('base64'),
     sha256Pin:sha256(signerDer),authorizedRoles:['visual-reviewer','device-reviewer','migration-reviewer']}],
   revokedKeyIds:[]},root.privateKey);
}
function pin(witness,role,id){
 const b=der(witness.publicKey);
 return {witnessId:id,role,spkiDerBase64:b.toString('base64'),sha256Pin:sha256(b)};
}
const pins=()=>[pin(witness1,'custody-witness','witness-one'),
  pin(witness2,'recovery-witness','witness-two')];
function anchor(){
 const obj={schemaVersion:1,sourceCommit,custodyRootSha256:sha256(der(root.publicKey)),
   minimumCustodyRevision:2,ledgerSequence:0,ledgerDigest:zero,
   issuedAt:'2026-10-10T13:00:00Z',expiresAt:'2026-10-10T13:45:00Z',
   nonce:uuid(100)};
 const payload=Buffer.from('MDD-P17-WITNESSED-ANCHOR-V1\n'+
   JSON.stringify(Object.keys(obj).sort().map(k=>[k,obj[k]])));
 return {...obj,signatures:pins().map((x,i)=>({witnessId:x.witnessId,role:x.role,
   signatureBase64:sign(null,payload,[witness1,witness2][i].privateKey).toString('base64')}))};
}
function receipt(){
 return signed({schemaVersion:1,sourceCommit,subjectType:'visual',
   subjectId:'capture-recovery-storage-failure.png',evidenceSha256:digest,
   nonce:uuid(0),decision:'accept',reviewerHandle:'independent-fixture',
   role:'visual-reviewer',issuedAt:'2026-10-10T13:05:00Z',expiresAt:'2026-10-10T13:40:00Z',
   keyId:'fixture-signer'},signer.privateKey);
}
function candidate(){
 const version='1.3.0', encoder=new TextEncoder();
 const files={'index.html':encoder.encode('<!doctype html><title>TEST</title>'),
   'build-info.json':encoder.encode(JSON.stringify({sourceCommit,version}))};
 const deploymentHashes=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,shaFile(b)]));
 const releaseArchive=zipSync(Object.fromEntries(Object.entries(files).map(([p,b])=>['my-daily-devotion/'+p,b])),{level:9});
 const archiveSha=shaFile(releaseArchive),hashes=artifactDigest(deploymentHashes);
 return {expectedSha:sourceCommit,releaseArchive,deploymentHashes,
   releaseManifest:{product:'My Daily Devotion',version,
     artifact:'my-daily-devotion-'+version+'-web.zip',sourceCommit,
     sha256:archiveSha,databaseSchemaVersion:3,fileCount:2,
     unpackedBytes:Object.values(files).reduce((x,b)=>x+b.byteLength,0),
     archiveBytes:releaseArchive.byteLength},
   buildEvidence:{sourceCommit,files:{...deploymentHashes},artifactDigest:hashes},
   verificationSummary:{sourceCommit,version,databaseSchema:3,
     unit:{passed:356,failed:0,skipped:0},
     browser:{expected:1158,unexpected:0,flaky:0,skipped:0},
     visual:{expected:526,unexpected:0,flaky:0,skipped:0},
     artifactDigest:hashes,packageSha256:archiveSha,deploymentFileCount:2},
 };
}
function closureInput(zipSha){
 const r=receipt(),row={sequence:1,previousDigest:zero,receipt:r,digest:zero};
 row.digest=recordDigest(row);
 const checkpoint=signed({schemaVersion:1,sourceCommit,rootKeyId:'fixture-root',
   fromSequence:0,priorDigest:zero,finalSequence:1,finalDigest:row.digest,
   issuedAt:'2026-10-10T13:15:00Z',expiresAt:'2026-10-10T13:40:00Z'},root.privateKey);
 return {sourceCommit,originalSiteUrl:site,anchor:anchor(),externalWitnessPins:pins(),
   previouslyAcceptedNonceIds:[],minimumAcceptedSequence:0,minimumAcceptedRevision:2,
   rootPublicSpkiDerBase64:der(root.publicKey).toString('base64'),
   manifest:rootRoster(),records:[row],checkpoint,previouslyUsedNonces:[],
   codeAuthorHandles:['source-author'],currentTime:now,
   deviceClaims:[],devicePackets:[],migrationPacket:null,
   archiveEvidence:{sourceCommit,archiveSha256:zipSha,
     localArtifactHashesVerified:true,runId:123,artifactId:456},
   recoveryPlan:{sourceCommit,existingSiteUrl:site,candidateSiteUrl:site,
     installedSchema:3,targetSchema:3,backupFormat:'portable-v1-encrypted',
     backupOffDeviceEncrypted:true,procedure:'fresh-compatible-profile-restore',
     destructiveSteps:[],evidenceSha256:digest},
 };
}
const denial=()=>({mode:'evidence-only',mergeAuthorized:false,deployAuthorized:false,
  publicationAuthorized:false,allowLiveMigration:false,allowCachePurge:false,allowRollback:false});
function input(){
 const candidateInput=candidate();
 return {expectedSha:sourceCommit,candidateInput,closureInput:closureInput(candidateInput.releaseManifest.sha256),
   handoff:{sourceCommit,originalSiteUrl:site,decision:denial(),
     reviewHandoffNonce:uuid(101),minimumCustodyRevision:2,minimumLedgerSequence:0},
   previouslyUsedHandoffNonces:[],githubEvidence:null};
}
const jobNames=['Unit, contracts and one production build','Reviewed journal image comparisons',
 'Browser chromium-1','Browser chromium-2','Browser chromium-3',
 'Browser mobile-1','Browser mobile-2','Browser firefox','Browser webkit','Browser offline',
 'Certify exact artifact and complete evidence'];
function github(){
 const id=123;
 return {run:{id,head_sha:sourceCommit,head_branch:'main',event:'push',
   name:'Release Certification CI',path:'.github/workflows/ci.yml',
   status:'completed',conclusion:'success'},
   jobs:jobNames.map((name,i)=>({name,id:i+1,run_id:id,status:'completed',conclusion:'success'})),
   artifacts:[{name:'mdd-certified-release',id:456,workflow_run:{id},
     expired:false,size_in_bytes:10000,digest:'sha256:'+'d'.repeat(64)}]};
}

const releaseOperator=generateKeyPairSync('ed25519');
const independentAuditor=generateKeyPairSync('ed25519');
const operatorPins=()=>[
 {witnessId:'fixture-operator',role:'release-operator',
  spkiDerBase64:der(releaseOperator.publicKey).toString('base64'),
  sha256Pin:sha256(der(releaseOperator.publicKey))},
 {witnessId:'fixture-auditor',role:'independent-evidence-auditor',
  spkiDerBase64:der(independentAuditor.publicKey).toString('base64'),
  sha256Pin:sha256(der(independentAuditor.publicKey))},
];
function operator(){
 const p18Input=input();
 const handoffProof=inspectP19Decision; // Always bind to the actual computed P18 handoff digest below.
 return {p18Input};
}
function makeRecord(p18Input,changes={}) {
 // Re-evaluate the actual P18 bytes to obtain a source- and nonce-bound digest.
 const proof=inspectIndependentHandoff(p18Input);
 const data={
   schemaVersion:1,sourceCommit,
   handoffDigestSha256:proof.handoffDigestSha256,
   releaseZipSha256:proof.releaseZipSha256,
   originalSiteUrl:site,decision:'HOLD_FOR_INDEPENDENT_REVIEW',
   nonce:uuid(103),previousSequence:7,previousDigest:'e'.repeat(64),
   gateStates:defaultHoldGates(),issuedAt:'2026-10-10T13:00:00Z',
   expiresAt:'2026-10-10T13:45:00Z',...changes,
 };
 const message=Buffer.from('MDD-P19-OPERATOR-HOLD-V1\n'+canonical(data));
 return {...data,signatures:operatorPins().map((p,i)=>({
   witnessId:p.witnessId,role:p.role,
   signatureBase64:sign(null,message,[releaseOperator,independentAuditor][i].privateKey).toString('base64'),
 }))};
}
function bundle() {
 const p18Input=input();
 return {expectedSha:sourceCommit,p18Input,
   operatorRecord:makeRecord(p18Input),externalOperatorPins:operatorPins(),
   externallyTrustedPriorSequence:7,externallyTrustedPriorDigest:'e'.repeat(64),
   previouslyUsedDecisionNonces:[],currentTime:now};
}

const rotated=[0,1,2].map(()=>generateKeyPairSync('ed25519'));
const ROLES=['previous-signer','replacement-signer','independent-custodian'];
const rotatingPins=()=>rotated.map((key,i)=>({
  role:ROLES[i],witnessId:['former-fixture','next-fixture','custodian-fixture'][i],
  spkiDerBase64:der(key.publicKey).toString('base64'),
  sha256Pin:sha256(der(key.publicKey)),
}));
function rotationPacket(overrides={}) {
 const pins=rotatingPins();
 const body={
  schemaVersion:1,sourceCommit,
  previousKeyId:'prior-test-signer',replacementKeyId:'replacement-test-signer',
  previousKeySha256:pins[0].sha256Pin,replacementKeySha256:pins[1].sha256Pin,
  custodyKeySha256:pins[2].sha256Pin,sequence:4,
  previousDigest:'f'.repeat(64),reason:'scheduled-rotation',
  event:'ROTATE_AND_REVOKE_PREVIOUS',nonce:uuid(105),
  issuedAt:'2026-10-10T13:00:00Z',expiresAt:'2026-10-10T13:45:00Z',
  ...overrides,
 };
 const msg=Buffer.from('MDD-P20-ROTATION-ATTESTATION-V1\n'+canonical(body));
 return {...body,signatures:pins.map((pin,i)=>({
   role:pin.role,witnessId:pin.witnessId,
   signatureBase64:sign(null,msg,rotated[i].privateKey).toString('base64'),
 }))};
}
function rotationInput(){
 return {rotation:rotationPacket(),externalPins:rotatingPins(),previousSequence:3,
   previousDigest:'f'.repeat(64),previouslyUsedRotationNonces:[],
   previousActiveKeyId:'prior-test-signer',previouslyRevokedKeyIds:[],currentTime:now};
}
function ticket(holdProof,rotProof){
 return {schemaVersion:1,sourceCommit,kind:'MANUAL_EVIDENCE_REVIEW_HOLD',
  nonce:uuid(106),createdAt:'2026-10-10T13:25:00Z',
  operatorHoldDigestSha256:holdProof.custodyRecordDigestSha256,
  rotationIntentDigestSha256:rotProof.rotationIntentDigestSha256,
  releaseZipSha256:holdProof.releaseZipSha256,
  originalSiteUrl:site,nextAction:'REQUEST_INDEPENDENT_OWNER_REVIEW',
  allowMerge:false,allowDeployment:false,allowPublication:false,
  allowLiveMigration:false,allowCachePurge:false,allowSchemaDowngrade:false,
 };
}
function phase(){
 const p19Input=bundle(),rotInput=rotationInput();
 const holdProof=inspectP19Decision(p19Input),rotationProof=inspectRotation({
   ...rotInput,sourceCommit,currentTime:now});
 return {sourceCommit,p19Input,rotationInput:rotInput,evidencePackets:[],
   ticket:ticket(holdProof,rotationProof),
   previouslyUsedEscalationNonces:[],currentTime:now};
}

const ownerKeys=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
const OWNER_ROLES=['precutover-owner','postrelease-auditor'];
const ownerPins=()=>ownerKeys.map((k,i)=>({
 role:OWNER_ROLES[i],witnessId:['pre-owner-fixture','post-auditor-fixture'][i],
 spkiDerBase64:der(k.publicKey).toString('base64'),
 sha256Pin:sha256(der(k.publicKey)),
}));
function hostPacket(){
 return {sourceCommit,originalSiteUrl:site,pwaScopeUrl:site,
   swScriptUrl:site+'service-worker.js',
   pwaManifestSha256:digest,serviceWorkerSha256:digest,
   originalHostEvidenceSha256:digest,sourceRightsEvidenceSha256:digest,
   rightsReviewStatus:'PENDING',cdnEvidenceSha256:digest,cdnReviewStatus:'PENDING'};
}
function p21Evidence(){
 return {sourceCommit,p20Input:phase(),hostPacket:hostPacket(),physicalPackets:[],recoveryPacket:null};
}
function ownerClosure(){
 const p21Input=p21Evidence(),e=inspectP21Evidence(p21Input);
 const evidenceDigestSha256=sha256(Buffer.from('MDD-P21-EVIDENCE-PACKET-V1\n'+canonical({
   sourceCommit,operatorHoldDigestSha256:e.operatorHoldDigestSha256,
   rotationIntentDigestSha256:e.rotationIntentDigestSha256,
   releaseZipSha256:e.immutableReleaseZipSha256,
   hostEvidenceDigestSha256:e.hostEvidenceDigestSha256,
 })));
 const make=(i,prevSeq,prevDigest)=>{
   const d={schemaVersion:1,sourceCommit,role:OWNER_ROLES[i],
     decision:['PRE_CUTOVER_HOLD','POST_RELEASE_NOT_EXECUTED'][i],
     evidenceDigestSha256,releaseZipSha256:e.immutableReleaseZipSha256,
     originalSiteUrl:site,previousSequence:prevSeq,previousDigest:prevDigest,
     nonce:uuid(200+i),issuedAt:['2026-10-10T13:10:00Z','2026-10-10T13:20:00Z'][i],
     expiresAt:'2026-10-10T13:45:00Z'};
   return {...d,signatureBase64:sign(null,
     Buffer.from('MDD-P21-HUMAN-RELEASE-DENIAL-V1\n'+canonical(d)),
     ownerKeys[i].privateKey).toString('base64')};
 };
 const first=make(0,5,'9'.repeat(64));
 const second=make(1,6,reviewDecisionDigest(first));
 return {sourceCommit,p21Input,ownerRecords:[first,second],
   independentOwnerPins:ownerPins(),trustedPreviousSequence:5,
   trustedPreviousDigest:'9'.repeat(64),
   previouslyUsedOwnerNonces:[],currentTime:now};
}
test('P21 source rights, original-host and PWA scope remain unverified',()=>{
 const r=inspectP21Evidence(p21Evidence());
 assert.equal(r.originAndPwaScopeStructurallyChecked,true);
 assert.equal(r.sourceRightsIndependentlyApproved,false);
 assert.equal(r.cdnRightsIndependentlyApproved,false);
 assert.equal(r.releaseAuthorized,false);
 assert.equal(r.backupRestoreActuallyPerformed,false);
});
test('separate pre/post cryptographic NO-GO decisions preserve release denial',()=>{
 const r=inspectP21OwnerClosure(ownerClosure());
 assert.equal(r.verifiedSignatureClaims,2);
 assert.deepEqual(r.reviewStages,['PRE_CUTOVER_HOLD','POST_RELEASE_NOT_EXECUTED']);
 assert.equal(r.releaseAuthorized,false);
 assert.equal(r.postreleaseOperationOccurred,false);
 assert.equal(r.productionMainCertificateVerified,false);
});
test('cross-origin original site, PWA scope movement and SW origin substitution rejected',()=>{
 const a=p21Evidence();a.hostPacket.originalSiteUrl='https://moved.example.test/devotion/';
 assert.throws(()=>inspectP21Evidence(a),/across origins/);
 const b=p21Evidence();b.hostPacket.pwaScopeUrl='https://original.example.test/other/';
 assert.throws(()=>inspectP21Evidence(b),/app path/);
 const c=p21Evidence();c.hostPacket.swScriptUrl='https://cdn.example.test/devotion/sw.js';
 assert.throws(()=>inspectP21Evidence(c),/Cross-origin service worker/);
 const d=p21Evidence();d.hostPacket.swScriptUrl=site+'?token=SECRET';
 assert.throws(()=>inspectP21Evidence(d),/tokens and fragments/);
});
test('service worker outside app scope, invalid manifest hash or non-script rejected',()=>{
 const a=p21Evidence();a.hostPacket.swScriptUrl='https://original.example.test/root-sw.js';
 assert.throws(()=>inspectP21Evidence(a),/outside the original app path/);
 const b=p21Evidence();b.hostPacket.serviceWorkerSha256='x'.repeat(64);
 assert.throws(()=>inspectP21Evidence(b));
 const c=p21Evidence();c.hostPacket.swScriptUrl=site+'image.jpg';
 assert.throws(()=>inspectP21Evidence(c),/must be a script/);
});
test('unapproved source rights or CDN must never be declared complete by claims',()=>{
 const a=p21Evidence();a.hostPacket.rightsReviewStatus='APPROVED';
 assert.throws(()=>inspectP21Evidence(a),/source rights cannot be automatically approved/);
 const b=p21Evidence();b.hostPacket.cdnReviewStatus='PASS';
 assert.throws(()=>inspectP21Evidence(b),/CDN rights/);
 const c=p21Evidence();c.hostPacket.privateLicense='DO_NOT_EXPORT';
 assert.throws(()=>inspectP21Evidence(c),/private metadata/);
});
test('unsourced physical Android and TalkBack claims cannot be accepted',()=>{
 const a=p21Evidence();a.physicalPackets=[{sourceCommit,kind:'android-device',
   subjectId:'android-chrome',reviewReceiptDigest:digest,evidenceSha256:digest,
   reviewStatus:'PENDING',deviceClass:'android-phone',claimedPhysical:true}];
 assert.throws(()=>inspectP21Evidence(a),/signed exact-source reviewer receipt/);
 const b=p21Evidence();b.physicalPackets=[{sourceCommit,kind:'accessibility',
   subjectId:'android-talkback',reviewReceiptDigest:digest,evidenceSha256:digest,
   reviewStatus:'APPROVED',deviceClass:'android-phone',claimedPhysical:true}];
 assert.throws(()=>inspectP21Evidence(b),/Only pending\/rejected/);
});
test('physical metadata cannot be emulator, wrong class, duplicate or private IDs',()=>{
 const pack={sourceCommit,kind:'android-device',subjectId:'android-chrome',
   reviewReceiptDigest:digest,evidenceSha256:digest,reviewStatus:'PENDING',
   deviceClass:'android-phone',claimedPhysical:true};
 const a=p21Evidence();a.physicalPackets=[{...pack,claimedPhysical:false}];
 assert.throws(()=>inspectP21Evidence(a),/Synthetic hardware/);
 const b=p21Evidence();b.physicalPackets=[{...pack,deviceClass:'desktop'}];
 assert.throws(()=>inspectP21Evidence(b),/device class/);
 const c=p21Evidence();c.physicalPackets=[{...pack,privateDeviceId:'SECRET'}];
 assert.throws(()=>inspectP21Evidence(c),/private metadata/);
});
function recoveryPacket(){
 return {sourceCommit,originalSiteUrl:site,previousStableCommit:'b'.repeat(40),
 previousStableArchiveSha256:digest,installedSchema:3,repairTargetSchema:3,
 backupFormat:'portable-v1-encrypted',offDeviceEncrypted:true,
 backupEvidenceSha256:digest,restoreEvidenceSha256:digest,recoveryEvidenceSha256:digest,
 profileKind:'disposable',method:'fresh-compatible-profile-restore',
 clearOriginStorage:false,purgeCaches:false,downgradeSchema:false,
 modifyLiveRecords:false,claimedOutcome:'PENDING'};
}
test('signed separate encrypted backup receipt is mandatory for forward recovery',()=>{
 const a=p21Evidence();a.recoveryPacket=recoveryPacket();
 assert.throws(()=>inspectP21Evidence(a),/separately signed encrypted-backup witness/);
});
test('forward recovery rejects schema downgrade, site storage purge and live profile',()=>{
 const a=p21Evidence();a.recoveryPacket={...recoveryPacket(),repairTargetSchema:1};
 assert.throws(()=>inspectP21Evidence(a),/Cannot downgrade/);
 const b=p21Evidence();b.recoveryPacket={...recoveryPacket(),purgeCaches:true};
 assert.throws(()=>inspectP21Evidence(b),/No destructive/);
 const c=p21Evidence();c.recoveryPacket={...recoveryPacket(),profileKind:'live'};
 assert.throws(()=>inspectP21Evidence(c),/No protected live profile/);
 const d=p21Evidence();d.recoveryPacket={...recoveryPacket(),offDeviceEncrypted:false};
 assert.throws(()=>inspectP21Evidence(d),/Encrypted off-device/);
});
test('previous stable archive identity and original HTTPS origin are immutable',()=>{
 const a=p21Evidence();a.recoveryPacket={...recoveryPacket(),previousStableCommit:sourceCommit};
 assert.throws(()=>inspectP21Evidence(a),/separately identified/);
 const b=p21Evidence();b.recoveryPacket={...recoveryPacket(),originalSiteUrl:'https://new.example.test/devotion/'};
 assert.throws(()=>inspectP21Evidence(b),/across origins/);
});
test('pre/post owner roles, distinct keys and signature validity cannot be substituted',()=>{
 const a=ownerClosure();a.ownerRecords[0].decision='MERGE_APPROVED';
 assert.throws(()=>inspectP21OwnerClosure(a),/cannot be converted to permission/);
 const b=ownerClosure();b.independentOwnerPins[1].spkiDerBase64=b.independentOwnerPins[0].spkiDerBase64;
 b.independentOwnerPins[1].sha256Pin=b.independentOwnerPins[0].sha256Pin;
 assert.throws(()=>inspectP21OwnerClosure(b),/cannot share the same key/);
 const c=ownerClosure();c.ownerRecords[1].signatureBase64='AAAA';
 assert.throws(()=>inspectP21OwnerClosure(c),/signature invalid/);
});
test('owner chain rejects outside checkpoint rollback, skipped sequence and forked record',()=>{
 const a=ownerClosure();a.trustedPreviousDigest='f'.repeat(64);
 assert.throws(()=>inspectP21OwnerClosure(a),/chain was forked/);
 const b=ownerClosure();b.ownerRecords[1].previousSequence=10;
 assert.throws(()=>inspectP21OwnerClosure(b),/chronology replay\/skip/);
 const c=ownerClosure();c.ownerRecords[1].previousDigest='e'.repeat(64);
 assert.throws(()=>inspectP21OwnerClosure(c),/chain was forked/);
});
test('owner nonce replay, expired decision or swapped signer are rejected',()=>{
 const a=ownerClosure();a.previouslyUsedOwnerNonces=[a.ownerRecords[0].nonce];
 assert.throws(()=>inspectP21OwnerClosure(a),/nonce replayed/);
 const b=ownerClosure();b.currentTime='2026-10-10T16:00:00Z';
 assert.throws(()=>inspectP21OwnerClosure(b),/expired or future/);
 const c=ownerClosure();c.ownerRecords[1].role='precutover-owner';
 assert.throws(()=>inspectP21OwnerClosure(c),/not in stage order/);
});
test('host review changed after owner signature breaks source-bound evidence digest',()=>{
 const a=ownerClosure();a.p21Input.hostPacket.sourceRightsEvidenceSha256='f'.repeat(64);
 assert.throws(()=>inspectP21OwnerClosure(a),/different physical or host evidence/);
 const b=ownerClosure();b.ownerRecords[0].privatePrayer='SECRET';
 assert.throws(()=>inspectP21OwnerClosure(b),/private metadata/);
});
test('P20 signer rotation and previous-stable HOLD remain mandatory P21 prerequisites',()=>{
 const a=p21Evidence();a.p20Input.rotationInput.rotation.previousDigest='f'.repeat(64).replace(/^f/,'e');
 assert.throws(()=>inspectP21Evidence(a),/Rotation custody history fork/);
 const b=p21Evidence();b.p20Input.ticket.allowDeployment=true;
 assert.throws(()=>inspectP21Evidence(b),/Executable release/);
});
