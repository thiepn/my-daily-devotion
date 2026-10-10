import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {artifactDigest} from '../certification/evidence.mjs';
import {canonical,sha256} from '../p16/custody.mjs';
import {recordDigest} from '../p16/receipt-history.mjs';
import {inspectP19Decision,defaultHoldGates} from '../p19/decision.mjs';
import {inspectIndependentHandoff} from '../p18/handoff.mjs';
import {inspectRotation} from './rotation.mjs';
import {inspectP20Escalation} from './escalation.mjs';

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
test('three-party rotation under external pins is structural evidence not live revocation',()=>{
 const r=inspectRotation({...rotationInput(),sourceCommit,currentTime:now});
 assert.equal(r.verifiedSignatures,3);
 assert.equal(r.replacementSignerActuallyActivated,false);
 assert.equal(r.revocationPublishedToLiveVerifier,false);
 assert.equal(r.releaseAuthorized,false);
});
test('operator HOLD can become source-bound manual escalation but never deployment',()=>{
 const result=inspectP20Escalation(phase());
 assert.equal(result.decision,'HOLD_ESCALATED_TO_INDEPENDENT_OWNER');
 assert.equal(result.releaseAuthorized,false);assert.equal(result.actionsPerformed,false);
 assert.equal(result.independentlyVerifiedPhysicalAndroid,false);
 assert.deepEqual(result.absentReviewPackets.physicalDevices,
   ['android-chrome','android-samsung-internet']);
});
test('rotation rejects prior sequence rollback, forked digest and revoked signer',()=>{
 const a=rotationInput();a.previousSequence=4;
 assert.throws(()=>inspectRotation({...a,sourceCommit}),/sequence skip or rollback/);
 const b=rotationInput();b.previousDigest='e'.repeat(64);
 assert.throws(()=>inspectRotation({...b,sourceCommit}),/history fork/);
 const c=rotationInput();c.previouslyRevokedKeyIds=['prior-test-signer'];
 assert.throws(()=>inspectRotation({...c,sourceCommit}),/Previously revoked/);
});
test('rotation intent may not claim executable key rotation or keep the same key',()=>{
 const a=rotationInput();a.rotation.event='ACTIVATE_PRODUCTION_KEY';
 assert.throws(()=>inspectRotation({...a,sourceCommit}),/Only fail-closed/);
 const b=rotationInput();b.rotation.replacementKeyId=b.rotation.previousKeyId;
 assert.throws(()=>inspectRotation({...b,sourceCommit}),/identity must change/);
 const c=rotationInput();c.rotation.privateKey='SECRET';
 assert.throws(()=>inspectRotation({...c,sourceCommit}),/private metadata/);
});
test('rotation denies reused nonce, stale SHA and expired attestation',()=>{
 const a=rotationInput();a.previouslyUsedRotationNonces=[a.rotation.nonce];
 assert.throws(()=>inspectRotation({...a,sourceCommit}),/nonce replayed/);
 const b=rotationInput();b.rotation.sourceCommit=other;
 assert.throws(()=>inspectRotation({...b,sourceCommit}),/stale source/);
 const c=rotationInput();c.currentTime='2026-10-10T14:00:00Z';
 assert.throws(()=>inspectRotation({...c,sourceCommit}),/expired or future/);
});
test('rotation key pins, distinct keys and signature roles cannot be spoofed',()=>{
 const a=rotationInput();a.externalPins[0].sha256Pin='d'.repeat(64);
 assert.throws(()=>inspectRotation({...a,sourceCommit}),/pin mismatch/);
 const b=rotationInput();b.externalPins[2].spkiDerBase64=b.externalPins[0].spkiDerBase64;
 b.externalPins[2].sha256Pin=b.externalPins[0].sha256Pin;
 assert.throws(()=>inspectRotation({...b,sourceCommit}),/Distinct cryptographic keys/);
 const c=rotationInput();c.rotation.signatures[1].signatureBase64='AAAA';
 assert.throws(()=>inspectRotation({...c,sourceCommit}),/Rotation signature failed/);
 const d=rotationInput();d.rotation.signatures[1].role='previous-signer';
 assert.throws(()=>inspectRotation({...d,sourceCommit}),/Duplicate or unknown/);
});
test('changed reviewed archive, P19 record or rotation attestation cannot reuse escalation',()=>{
 const a=phase();a.ticket.releaseZipSha256='a'.repeat(64);
 assert.throws(()=>inspectP20Escalation(a),/different artifact bytes/);
 const b=phase();b.ticket.operatorHoldDigestSha256='b'.repeat(64);
 assert.throws(()=>inspectP20Escalation(b),/different operator hold/);
 const c=phase();c.ticket.rotationIntentDigestSha256='d'.repeat(64);
 assert.throws(()=>inspectP20Escalation(c),/different custody rotation/);
});
test('changed ZIP bytes fail during P19 proof before escalation can be created',()=>{
 const a=phase();a.p19Input.p18Input.candidateInput.releaseArchive=
   a.p19Input.p18Input.candidateInput.releaseArchive.slice();
 a.p19Input.p18Input.candidateInput.releaseArchive[9]^=0xff;
 assert.throws(()=>inspectP20Escalation(a),/Downloaded archive is not the tested release/);
});
test('false operator authority and cache purge intent always fail',()=>{
 for(const field of ['allowMerge','allowDeployment','allowPublication',
  'allowLiveMigration','allowCachePurge','allowSchemaDowngrade']){
  const a=phase();a.ticket[field]=true;
  assert.throws(()=>inspectP20Escalation(a),/Executable release/);
 }
 const b=phase();b.ticket.nextAction='DEPLOY';
 assert.throws(()=>inspectP20Escalation(b));
});
test('ticket nonce replay, expired timestamp, and private fields are blocked',()=>{
 const a=phase();a.previouslyUsedEscalationNonces=[a.ticket.nonce];
 assert.throws(()=>inspectP20Escalation(a),/ticket replayed/);
 const b=phase();b.currentTime='2026-10-10T16:00:00Z';
 assert.throws(()=>inspectP20Escalation(b),/Stale\/future escalation/);
 const c=phase();c.ticket.privatePrayer='SECRET_DEVOTION';
 assert.throws(()=>inspectP20Escalation(c),/private metadata/);
});
test('device and migration claims must bind to signed exact SHA and record digest',()=>{
 const a=phase();a.evidencePackets=[{sourceCommit,kind:'android-device',
  subjectId:'android-chrome',evidenceSha256:digest,signedReceiptDigest:'d'.repeat(64),
  claimedOutcome:'PENDING',claimedPhysical:true}];
 assert.throws(()=>inspectP20Escalation(a),/no exact-source signed reviewer receipt/);
 const b=phase();b.evidencePackets=[{sourceCommit,kind:'migration-backup',
  subjectId:'original-origin-schema-migration',evidenceSha256:digest,
  signedReceiptDigest:'d'.repeat(64),claimedOutcome:'APPROVED',claimedPhysical:true}];
 assert.throws(()=>inspectP20Escalation(b),/cannot be marked approved/);
});
test('synthetic, unknown, duplicate, or private device evidence is refused',()=>{
 const q={sourceCommit,kind:'android-device',subjectId:'android-chrome',
  evidenceSha256:digest,signedReceiptDigest:'d'.repeat(64),
  claimedOutcome:'PENDING',claimedPhysical:true};
 const a=phase();a.evidencePackets=[{...q,claimedPhysical:false}];
 assert.throws(()=>inspectP20Escalation(a),/Synthetic or emulator/);
 const b=phase();b.evidencePackets=[{...q,deviceId:'PERSONAL'}];
 assert.throws(()=>inspectP20Escalation(b),/private metadata/);
 const c=phase();c.evidencePackets=[{...q,kind:'drone-device'}];
 assert.throws(()=>inspectP20Escalation(c),/Unknown protected review kind/);
});
test('source-bound escalation digest changes per nonce but never leaks reviewer handles',()=>{
 const a=phase(),x=inspectP20Escalation(a);
 const b=phase();b.ticket.nonce=uuid(107);
 const y=inspectP20Escalation(b);
 assert.notEqual(x.ticketDigestSha256,y.ticketDigestSha256);
 assert.ok(!JSON.stringify(x).includes('independent-fixture'));
 assert.equal(y.releaseAuthorized,false);
});
