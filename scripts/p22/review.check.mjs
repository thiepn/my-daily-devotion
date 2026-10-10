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
import {inspectP21Evidence} from '../p21/evidence.mjs';
import {inspectP21OwnerClosure,reviewDecisionDigest} from '../p21/owner-closure.mjs';
import {inspectP22Review} from './review.mjs';
import {inspectSourceCustody} from './source-custody.mjs';

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

const escrowSigners=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
const roles=['source-custodian','independent-rights-reviewer'];
const escrowPins=()=>escrowSigners.map((k,i)=>({
 role:roles[i],witnessId:['source-fixture','rights-fixture'][i],
 spkiDerBase64:der(k.publicKey).toString('base64'),
 sha256Pin:sha256(der(k.publicKey)),
}));
function escrow() {
 const host=hostPacket(),mapping={
  'original-object':host.originalHostEvidenceSha256,
  'source-rights':host.sourceRightsEvidenceSha256,
  'cdn-rights':host.cdnEvidenceSha256,
  'pwa-manifest':host.pwaManifestSha256,
  'service-worker':host.serviceWorkerSha256,
  'offline-cache':host.originalHostEvidenceSha256,
 };
 const body={schemaVersion:1,sourceCommit,originalSiteUrl:site,pwaScopeUrl:site,
   swScriptUrl:host.swScriptUrl,rightsStatus:'REVIEW_PENDING',cdnStatus:'REVIEW_PENDING',
   materials:Object.entries(mapping).map(([kind,evidenceSha256])=>({
     kind,evidenceSha256,status:'REVIEW_PENDING',sourceCommit,
   })),
   priorSequence:11,priorDigest:'e'.repeat(64),sequence:12,
   nonce:uuid(250),issuedAt:'2026-10-10T13:00:00Z',
   expiresAt:'2026-10-10T13:45:00Z',disposition:'ESCROW_ONLY_NO_RELEASE'};
 const msg=Buffer.from('MDD-P22-SOURCE-CUSTODY-V1\n'+canonical(body));
 return {...body,signatures:escrowPins().map((p,i)=>({
   role:p.role,witnessId:p.witnessId,
   signatureBase64:sign(null,msg,escrowSigners[i].privateKey).toString('base64'),
 }))};
}
function p22() {
 return {sourceCommit,p21OwnerInput:ownerClosure(),escrow:escrow(),
   externalEscrowPins:escrowPins(),trustedPreviousEscrowSequence:11,
   trustedPreviousEscrowDigest:'e'.repeat(64),
   previouslyUsedEscrowNonces:[],reviewPackets:[],previousStable:null,currentTime:now};
}
function saved() {
 return {sourceCommit,originalSiteUrl:site,previousStableCommit:'b'.repeat(40),
   previousStableArchiveSha256:digest,previousStableEvidenceSha256:digest,
   offDeviceBackupSha256:digest,restoreAttemptEvidenceSha256:digest,
   backupFormat:'portable-v1-encrypted',encryptedOffDevice:true,
   installedSchema:3,repairTargetSchema:3,restoreProfile:'disposable',
   disposition:'PENDING',deleteOriginalData:false,purgeCaches:false,
   downgradeSchema:false,writeProductionJournal:false};
}
test('independent source escrow and P21 NO_GO evaluate actual ZIP and retain denial',()=>{
 const r=inspectP22Review(p22());
 assert.equal(r.decision,'INDEPENDENT_REVIEW_REQUIRED_NO_GO');
 assert.equal(r.originalSourceAndRightsProvenanceStructurallyChecked,true);
 assert.equal(r.rightsOwnershipIndependentlyAuthenticated,false);
 assert.equal(r.actualPrecutoverOwnerApproval,false);
 assert.equal(r.actualPostreleaseReviewPerformed,false);
 assert.equal(r.releaseAuthorized,false);
 assert.equal(r.actionsPerformed,false);
});
test('escrow has 2 real cryptographic signatures but no automatic rights approval',()=>{
 const b=p22(),r=inspectSourceCustody({
 sourceCommit,originalSiteUrl:site,hostPacket:hostPacket(),escrow:b.escrow,
 externalPins:b.externalEscrowPins,trustedPreviousSequence:11,
 trustedPreviousDigest:'e'.repeat(64),previouslyUsedEscrowNonces:[],currentTime:now});
 assert.equal(r.verifiedEscrowSignatures,2);
 assert.equal(r.rightsIndependentlyLicensed,false);
 assert.equal(r.actualOfflinePwaTestPerformed,false);
});
test('escrow cannot change source SHA, original origin or PWA scope',()=>{
 const a=p22();a.escrow.sourceCommit=other;
 assert.throws(()=>inspectP22Review(a),/Escrow source SHA mismatch/);
 const b=p22();b.escrow.originalSiteUrl='https://other.example.test/devotion/';
 assert.throws(()=>inspectP22Review(b),/across origins/);
 const c=p22();c.escrow.pwaScopeUrl='https://original.example.test/wrong/';
 assert.throws(()=>inspectP22Review(c),/app path/);
});
test('offline and source-rights hashes must match P21 original-host evidence',()=>{
 const a=p22();a.escrow.materials[0].evidenceSha256='f'.repeat(64);
 assert.throws(()=>inspectP22Review(a),/differs from original-host packet/);
 const b=p22();b.escrow.materials[5].evidenceSha256='f'.repeat(64);
 assert.throws(()=>inspectP22Review(b),/differs from original-host packet/);
 const c=p22();c.escrow.materials[2].sourceCommit=other;
 assert.throws(()=>inspectP22Review(c),/another commit/);
});
test('rights/CDN cannot be declared approved and cannot sneak in private metadata',()=>{
 const a=p22();a.escrow.rightsStatus='APPROVED';
 assert.throws(()=>inspectP22Review(a),/cannot be self-approved/);
 const b=p22();b.escrow.materials[1].status='APPROVED';
 assert.throws(()=>inspectP22Review(b),/may not self-approve/);
 const c=p22();c.escrow.privateJournal='SECRET';
 assert.throws(()=>inspectP22Review(c),/private metadata/);
});
test('missing, duplicated or unknown material kinds are rejected',()=>{
 const a=p22();a.escrow.materials.pop();
 assert.throws(()=>inspectP22Review(a),/Six bounded/);
 const b=p22();b.escrow.materials[1].kind='original-object';
 assert.throws(()=>inspectP22Review(b),/Duplicate\/unknown/);
 const c=p22();c.escrow.materials[0].kind='private-journal';
 assert.throws(()=>inspectP22Review(c),/Duplicate\/unknown/);
});
test('independently retained sequence/digest and nonce histories prevent replay',()=>{
 const a=p22();a.trustedPreviousEscrowSequence=12;
 assert.throws(()=>inspectP22Review(a),/Escrow sequence anchor differs/);
 const b=p22();b.trustedPreviousEscrowDigest='f'.repeat(64);
 assert.throws(()=>inspectP22Review(b),/Escrow history fork\/replay/);
 const c=p22();c.previouslyUsedEscrowNonces=[c.escrow.nonce];
 assert.throws(()=>inspectP22Review(c),/nonce already used/);
});
test('escrow expiry and signed payload tampering fail',()=>{
 const a=p22();a.escrow.nonce=uuid(251);
 assert.throws(()=>inspectP22Review(a),/Signed escrow payload changed/);
 const b=p22();b.currentTime='2026-10-10T14:30:00Z';
 assert.throws(()=>inspectP22Review(b),/expired or future/);
 const c=p22();c.escrow.signatures[0].signatureBase64='AAAA';
 assert.throws(()=>inspectP22Review(c),/Signed escrow payload changed/);
});
test('external custodian and independent rights signatures require distinct public keys',()=>{
 const a=p22();a.externalEscrowPins[1].spkiDerBase64=a.externalEscrowPins[0].spkiDerBase64;
 a.externalEscrowPins[1].sha256Pin=a.externalEscrowPins[0].sha256Pin;
 assert.throws(()=>inspectP22Review(a),/keys must be distinct/);
 const b=p22();b.externalEscrowPins[1].witnessId=b.externalEscrowPins[0].witnessId;
 assert.throws(()=>inspectP22Review(b),/identities must differ/);
 const c=p22();c.externalEscrowPins[0].sha256Pin='d'.repeat(64);
 assert.throws(()=>inspectP22Review(c),/public pin mismatch/);
});
test('false reviewer permission or unsupported physical evidence cannot be accepted',()=>{
 const claim={sourceCommit,kind:'android-device',subjectId:'android-chrome',
   receiptDigest:digest,evidenceSha256:digest,
   reviewStatus:'PENDING',physicalDeviceClaim:true,reviewedOnOriginalHostClaim:true};
 const a=p22();a.reviewPackets=[{...claim,reviewStatus:'ACCEPTED'}];
 assert.throws(()=>inspectP22Review(a),/Unverified review cannot claim approval/);
 const b=p22();b.reviewPackets=[claim];
 assert.throws(()=>inspectP22Review(b),/signed reviewer receipt missing/);
 const c=p22();c.reviewPackets=[{...claim,deviceId:'secret'}];
 assert.throws(()=>inspectP22Review(c),/private metadata/);
});
test('previous stable build and encrypted backup cannot be invented without reviewer receipt',()=>{
 const a=p22();a.previousStable=saved();
 assert.throws(()=>inspectP22Review(a),/Separately signed encrypted backup custody required/);
 const b=p22();b.previousStable={...saved(),previousStableCommit:sourceCommit};
 assert.throws(()=>inspectP22Review(b),/distinct identified source/);
});
test('recovery cannot downgrade schema, touch protected user data, or run in a live profile',()=>{
 const a=p22();a.previousStable={...saved(),repairTargetSchema:1};
 assert.throws(()=>inspectP22Review(a),/Downgrade of physical journal schema/);
 const b=p22();b.previousStable={...saved(),writeProductionJournal:true};
 assert.throws(()=>inspectP22Review(b),/Non-destructive recovery required/);
 const c=p22();c.previousStable={...saved(),restoreProfile:'production'};
 assert.throws(()=>inspectP22Review(c),/Protected production profile/);
 const d=p22();d.previousStable={...saved(),encryptedOffDevice:false};
 assert.throws(()=>inspectP22Review(d),/Encrypted backup must exist/);
});
test('P21 owner signatures must remain valid, chronological and NO_GO',()=>{
 const a=p22();a.p21OwnerInput.ownerRecords[0].decision='DEPLOY_APPROVED';
 assert.throws(()=>inspectP22Review(a),/cannot be converted to permission/);
 const b=p22();b.p21OwnerInput.ownerRecords[1].previousDigest='f'.repeat(64);
 assert.throws(()=>inspectP22Review(b),/chain was forked/);
 const c=p22();c.p21OwnerInput.p21Input.p20Input.ticket.allowDeployment=true;
 assert.throws(()=>inspectP22Review(c),/Executable release/);
});
test('tampered actual release ZIP is blocked before escrow can be accepted',()=>{
 const a=p22(),candidate=a.p21OwnerInput.p21Input.p20Input.p19Input.p18Input.candidateInput;
 candidate.releaseArchive=candidate.releaseArchive.slice();
 candidate.releaseArchive[9]^=0xff;
 assert.throws(()=>inspectP22Review(a),/Downloaded archive is not the tested release/);
});
