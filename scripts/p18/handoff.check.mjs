import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {zipSync} from 'fflate';
import {artifactDigest} from '../certification/evidence.mjs';
import {canonical,sha256} from '../p16/custody.mjs';
import {recordDigest} from '../p16/receipt-history.mjs';
import {inspectIndependentHandoff} from './handoff.mjs';

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
test('actual release archive bytes and P17 witness chain match; nevertheless never authorize release',()=>{
 const r=inspectIndependentHandoff(input());
 assert.equal(r.immutableLocalReleaseZipVerified,true);
 assert.equal(r.witnessedCustodySignatureClaims,2);
 assert.equal(r.outstandingVisualDecisions.length,8);
 assert.equal(r.releaseAuthorized,false);assert.equal(r.actionsPerformed,false);
 assert.equal(r.trustPinsAuthenticatedOutOfBand,false);
 assert.match(r.handoffDigestSha256,/^[0-9a-f]{64}$/);
});
test('tampering with even one ZIP byte fails before handoff generation',()=>{
 const a=input();a.candidateInput.releaseArchive=a.candidateInput.releaseArchive.slice();
 a.candidateInput.releaseArchive[9]^=0xff;
 assert.throws(()=>inspectIndependentHandoff(a),/Downloaded archive is not the tested release/);
});
test('rejects synthetic source substitution in ZIP, ledger, and handoff',()=>{
 const a=input();a.candidateInput.buildEvidence.sourceCommit=other;
 assert.throws(()=>inspectIndependentHandoff(a),/Tested build source SHA mismatch/);
 const b=input();b.closureInput.sourceCommit=other;
 assert.throws(()=>inspectIndependentHandoff(b),/P17 evidence source mismatch/);
 const c=input();c.handoff.sourceCommit=other;
 assert.throws(()=>inspectIndependentHandoff(c),/Handoff source mismatch/);
});
test('reviewer-signed claim must name exact real archive bytes',()=>{
 const a=input();a.closureInput.archiveEvidence.archiveSha256='f'.repeat(64);
 assert.throws(()=>inspectIndependentHandoff(a),/reviewed artifact differs/);
});
test('replay history must be external, no self-contained nonce reset',()=>{
 const a=input();a.previouslyUsedHandoffNonces=[a.handoff.reviewHandoffNonce];
 assert.throws(()=>inspectIndependentHandoff(a),/Replayed operator handoff nonce/);
 const b=input();delete b.previouslyUsedHandoffNonces;
 assert.throws(()=>inspectIndependentHandoff(b),/Independent handoff nonce history required/);
 const c=input();c.handoff.previouslyUsedHandoffNonces=[];
 assert.throws(()=>inspectIndependentHandoff(c),/private metadata field/);
});
test('signed witness input cannot supply a lower revision or previous checkpoint than handoff',()=>{
 const a=input();a.handoff.minimumCustodyRevision=3;
 assert.throws(()=>inspectIndependentHandoff(a),/External custody revision floor differs/);
 const b=input();b.closureInput.minimumAcceptedSequence=1;
 assert.throws(()=>inspectIndependentHandoff(b),/External ledger floor differs/);
});
test('same origin and path required for both handoff and P17 evidence',()=>{
 const a=input();a.handoff.originalSiteUrl='https://other.example.test/devotion/';
 assert.throws(()=>inspectIndependentHandoff(a),/across origins/);
 const b=input();b.closureInput.originalSiteUrl='https://original.example.test/else/';
 assert.throws(()=>inspectIndependentHandoff(b),/app path/);
});
test('invalid operator merge, deployment, publication, live migrations and purges are rejected',()=>{
 for(const name of Object.keys(denial()).filter(x=>x!=='mode')) {
   const a=input();a.handoff.decision[name]=true;
   assert.throws(()=>inspectIndependentHandoff(a),/Operator action forbidden/);
 }
});
test('honest-looking main certification metadata is a claim, not authenticated release approval',()=>{
 const a=input();a.githubEvidence=github();
 const r=inspectIndependentHandoff(a);
 assert.equal(r.githubRunMetadataCorroborated,true);
 assert.equal(r.artifactIdClaim,456);
 assert.equal(r.githubApiResponsesIndependentlyAuthenticated,false);
 assert.equal(r.productionReleaseCertificateVerified,false);
 assert.equal(r.releaseAuthorized,false);
});
test('reject foreign-run, PR and changed artifact identity',()=>{
 const a=input();a.githubEvidence=github();a.githubEvidence.run.event='pull_request';
 assert.throws(()=>inspectIndependentHandoff(a),/Disallowed CI trigger/);
 const b=input();b.githubEvidence=github();b.githubEvidence.artifacts[0].id=789;
 assert.throws(()=>inspectIndependentHandoff(b),/another artifact ID/);
 const c=input();c.githubEvidence=github();c.githubEvidence.jobs[0].run_id=987;
 assert.throws(()=>inspectIndependentHandoff(c),/Job belongs to another run/);
});
test('refuses redacted source/identity changes and invalid recovery upgrades',()=>{
 const a=input();a.closureInput.anchor.sourceCommit=other;
 assert.throws(()=>inspectIndependentHandoff(a),/Anchor source SHA mismatch/);
 const b=input();b.closureInput.recoveryPlan.targetSchema=1;
 assert.throws(()=>inspectIndependentHandoff(b),/No database downgrade/);
 const c=input();c.closureInput.manifest.revokedKeyIds=['fixture-signer'];
 assert.throws(()=>inspectIndependentHandoff(c),/Custody signature invalid/);
});
test('handoff digest changes with source-bound nonce and never contains private reviewer text',()=>{
 const a=input();const x=inspectIndependentHandoff(a);
 const b=input();b.handoff.reviewHandoffNonce=uuid(102);
 const y=inspectIndependentHandoff(b);
 assert.notEqual(x.handoffDigestSha256,y.handoffDigestSha256);
 assert.ok(!JSON.stringify(x).includes('independent-fixture'));
 assert.equal(y.releaseAuthorized,false);
});
