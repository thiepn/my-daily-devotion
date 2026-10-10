import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {artifactDigest} from '../certification/evidence.mjs';
import {canonical,sha256} from '../p16/custody.mjs';
import {recordDigest} from '../p16/receipt-history.mjs';
import {inspectP19Decision,defaultHoldGates} from './decision.mjs';
import {inspectIndependentHandoff} from '../p18/handoff.mjs';

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
test('dual-signed operator HOLD verifies real P18 archive and never grants release',()=>{
 const r=inspectP19Decision(bundle());
 assert.equal(r.signedOperatorClaimsVerified,2);
 assert.equal(r.nextCustodySequence,8);
 assert.equal(r.stillOpenReleaseGates.length,12);
 assert.equal(r.releaseAuthorized,false);assert.equal(r.deployAuthorized,false);
 assert.equal(r.actionsPerformed,false);assert.equal(r.humanDeviceEvidenceActuallyObserved,false);
});
test('wrong archived bytes fail before signed release custody may be evaluated',()=>{
 const a=bundle();a.p18Input.candidateInput.releaseArchive=a.p18Input.candidateInput.releaseArchive.slice();
 a.p18Input.candidateInput.releaseArchive[12]^=0xff;
 assert.throws(()=>inspectP19Decision(a),/Downloaded archive is not the tested release/);
});
test('forged released decision or production release authorization cannot be signed',()=>{
 const a=bundle();a.operatorRecord.decision='DEPLOY_APPROVED';
 assert.throws(()=>inspectP19Decision(a),/Unsupported or executable/);
 const b=bundle();b.operatorRecord.deployAuthorized=true;
 assert.throws(()=>inspectP19Decision(b),/private metadata field/);
 const c=bundle();c.operatorRecord.gateStates[0].status='APPROVED';
 assert.throws(()=>inspectP19Decision(c),/Cannot mark missing human gate approved/);
});
test('wrong source, external historical digest and sequence fail',()=>{
 const a=bundle();a.operatorRecord.sourceCommit=other;
 assert.throws(()=>inspectP19Decision(a),/Operator source SHA mismatch/);
 const b=bundle();b.externallyTrustedPriorDigest='d'.repeat(64);
 assert.throws(()=>inspectP19Decision(b),/digest differs/);
 const c=bundle();c.externallyTrustedPriorSequence=8;
 assert.throws(()=>inspectP19Decision(c),/sequence differs/);
});
test('operator nonce replayed against separately sourced history is blocked',()=>{
 const a=bundle();a.previouslyUsedDecisionNonces=[a.operatorRecord.nonce];
 assert.throws(()=>inspectP19Decision(a),/replayed/);
 const b=bundle();b.previouslyUsedDecisionNonces=[uuid(999),uuid(999)];
 assert.throws(()=>inspectP19Decision(b),/Duplicate externally used nonce/);
});
test('tampering handoff SHA, ZIP reference, origin and gate after signing is blocked',()=>{
 const a=bundle();a.operatorRecord.handoffDigestSha256='f'.repeat(64);
 assert.throws(()=>inspectP19Decision(a),/another evidence handoff/);
 const b=bundle();b.operatorRecord.releaseZipSha256='f'.repeat(64);
 assert.throws(()=>inspectP19Decision(b),/another release archive/);
 const c=bundle();c.operatorRecord.originalSiteUrl='https://other.example.test/devotion/';
 assert.throws(()=>inspectP19Decision(c),/origin mismatch/);
 const d=bundle();d.operatorRecord.gateStates[0].id=d.operatorRecord.gateStates[1].id;
 assert.throws(()=>inspectP19Decision(d),/Unknown or duplicate/);
});
test('operator and auditor need independently pinned and distinct Ed25519 keys',()=>{
 const a=bundle();a.externalOperatorPins[1].sha256Pin=a.externalOperatorPins[0].sha256Pin;
 a.externalOperatorPins[1].spkiDerBase64=a.externalOperatorPins[0].spkiDerBase64;
 assert.throws(()=>inspectP19Decision(a),/cannot share one key/);
 const b=bundle();b.externalOperatorPins[1].witnessId=b.externalOperatorPins[0].witnessId;
 assert.throws(()=>inspectP19Decision(b),/Independent signer identities/);
 const c=bundle();c.externalOperatorPins[0].sha256Pin='f'.repeat(64);
 assert.throws(()=>inspectP19Decision(c),/External operator key pin mismatch/);
});
test('tampered signatures, exchanged signatures and unauthorized roles fail closed',()=>{
 const a=bundle();a.operatorRecord.signatures[0].signatureBase64='AAAA';
 assert.throws(()=>inspectP19Decision(a),/Operator custody signature invalid/);
 const b=bundle();b.operatorRecord.signatures[0].role='independent-evidence-auditor';
 assert.throws(()=>inspectP19Decision(b),/Signer identity differs|Duplicate or unknown/);
 const c=bundle();c.operatorRecord.signatures[1].signatureBase64=c.operatorRecord.signatures[0].signatureBase64;
 assert.throws(()=>inspectP19Decision(c),/Operator custody signature invalid/);
});
test('expiry, missing gates, duplicate gates and private fields fail closed',()=>{
 const a=bundle();a.currentTime='2026-10-10T14:00:00Z';
 assert.throws(()=>inspectP19Decision(a),/expired or future/);
 const b=bundle();b.operatorRecord.gateStates.pop();
 assert.throws(()=>inspectP19Decision(b),/Missing operator gate statuses/);
 const c=bundle();c.operatorRecord.privateJournal='DO_NOT_LOG';
 assert.throws(()=>inspectP19Decision(c),/private metadata field/);
});
test('stale P18 custody and a fabricated approved GitHub main certificate remain blocked',()=>{
 const a=bundle();a.p18Input.closureInput.anchor.sourceCommit=other;
 assert.throws(()=>inspectP19Decision(a),/Anchor source SHA mismatch/);
 const b=bundle();b.p18Input.githubEvidence=github();
 b.p18Input.githubEvidence.run.event='pull_request';
 assert.throws(()=>inspectP19Decision(b),/Disallowed CI trigger/);
});
test('same underlying evidence with different handoff nonce requires distinct signed custody',()=>{
 const a=bundle(),r=inspectP19Decision(a);
 const b=bundle();b.p18Input.handoff.reviewHandoffNonce=uuid(104);
 assert.throws(()=>inspectP19Decision(b),/another evidence handoff/);
 assert.equal(r.releaseAuthorized,false);
});
