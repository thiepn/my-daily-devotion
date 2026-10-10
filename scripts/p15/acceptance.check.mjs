import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { attestationPayload, inspectSignedAcceptance, REQUIRED_VISUAL_DECISIONS } from './attestations.mjs';
import { rehearseCandidate, pendingRehearsalGates } from './rehearsal.mjs';

const sha='a'.repeat(40),other='b'.repeat(40),evidenceHash='f'.repeat(64);
const now='2026-10-10T01:00:00Z';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const der=publicKey.export({format:'der',type:'spki'});
const trust=()=>({schemaVersion:1,keyId:'test-fixture-only',spkiDerBase64:der.toString('base64'),
  sha256Pin:createHash('sha256').update(der).digest('hex'),revoked:false,
  validFrom:'2026-10-09T00:00:00Z',validUntil:'2026-10-12T00:00:00Z',
  authorizedRoles:['visual-reviewer','device-reviewer','migration-reviewer','release-operator']});
const make=(updates={})=>{
 const claim={schemaVersion:1,sourceCommit:sha,subjectType:'visual',
   subjectId:REQUIRED_VISUAL_DECISIONS[0],evidenceSha256:evidenceHash,
   nonce:'123e4567-e89b-42d3-a456-426614174000',decision:'accept',
   reviewerHandle:'independent-test-reviewer',role:'visual-reviewer',
   issuedAt:'2026-10-10T00:00:00Z',expiresAt:'2026-10-11T00:00:00Z',
   keyId:'test-fixture-only',...updates};
 return {...claim,signatureBase64:sign(null,attestationPayload({...claim,signatureBase64:''}),privateKey).toString('base64')};
};
const args=(claims=[make()])=>({sourceCommit:sha,trustRoot:trust(),attestations:claims,
  previouslyUsedNonces:[],codeAuthorHandles:['source-author'],now});
function rehearsal(){
 return {sourceCommit:sha,originalSiteUrl:'https://old.example.test/devotion/',
   proposedSiteUrl:'https://old.example.test/devotion/',
   archiveEvidence:{sourceCommit:sha,archiveSha256:evidenceHash,localArtifactHashesVerified:true,runId:123,artifactId:456},
   reviewInspection:{sourceCommit:sha,requiredVisualDecisionsStillMissing:[...REQUIRED_VISUAL_DECISIONS],
     verifiedCryptographicSignatures:0,releaseAuthorized:false},
   gateClaims:pendingRehearsalGates(),
   recoveryPlan:{sourceCommit:sha,existingSiteUrl:'https://old.example.test/devotion/',
     candidateSiteUrl:'https://old.example.test/devotion/',installedSchema:3,targetSchema:3,
     backupFormat:'portable-v1-encrypted',backupOffDeviceEncrypted:true,
     procedure:'fresh-compatible-profile-restore',destructiveSteps:[],evidenceSha256:evidenceHash},
   operatorDecision:{mode:'dry-run-only',mergeAuthorized:false,deployAuthorized:false,publicationAuthorized:false},
 };
}
test('ephemeral test-only Ed25519 signature verifies without release authority',()=>{
 const result=inspectSignedAcceptance(args());
 assert.equal(result.verifiedCryptographicSignatures,1);
 assert.equal(result.requiredVisualDecisionsStillMissing.length,8);
 assert.equal(result.trustRootProvisionedByIndependentOperator,false);
 assert.equal(result.releaseAuthorized,false);
});
test('wrong source SHA, tampering after signing and wrong public key are rejected',()=>{
 const a=args();a.sourceCommit=other;assert.throws(()=>inspectSignedAcceptance(a),/Stale/);
 const b=args();b.attestations[0].decision='reject';assert.throws(()=>inspectSignedAcceptance(b),/Bad Ed25519 signature/);
 const c=args();c.trustRoot.sha256Pin='0'.repeat(64);
 assert.throws(()=>inspectSignedAcceptance(c),/fingerprint mismatch/);
});
test('expired or revoked key and expired or future evidence cannot pass',()=>{
 const a=args();a.trustRoot.revoked=true;assert.throws(()=>inspectSignedAcceptance(a),/Revoked/);
 const b=args();b.trustRoot.validUntil='2026-10-09T00:00:00Z';
 assert.throws(()=>inspectSignedAcceptance(b),/validity period/);
 const c=args([make({expiresAt:'2026-10-09T00:00:00Z'})]);
 assert.throws(()=>inspectSignedAcceptance(c),/expired, future/);
 const d=args([make({issuedAt:'2026-10-11T00:00:00Z'})]);
 assert.throws(()=>inspectSignedAcceptance(d),/expired, future/);
});
test('reused nonce from external list or repeated attestation is rejected',()=>{
 const a=args();a.previouslyUsedNonces=[a.attestations[0].nonce];
 assert.throws(()=>inspectSignedAcceptance(a),/replayed/);
 const b=args([make(),make()]);assert.throws(()=>inspectSignedAcceptance(b),/replayed/);
});
test('code author cannot use a signature to independently sign off their changes',()=>{
 const a=args();a.codeAuthorHandles=['independent-test-reviewer'];
 assert.throws(()=>inspectSignedAcceptance(a),/Code author cannot/);
});
test('invalid roles and subjects cannot be elevated by a syntactically valid signature',()=>{
 const a=args([make({role:'release-operator'})]);
 assert.throws(()=>inspectSignedAcceptance(a),/Role cannot approve/);
 const b=args([make({subjectId:'not-a-baseline.png'})]);
 assert.throws(()=>inspectSignedAcceptance(b),/Unexpected subject/);
 const c=args();c.trustRoot.authorizedRoles=['release-operator'];
 assert.throws(()=>inspectSignedAcceptance(c),/Signer not authorized/);
});
test('rejects private evidence fields, unsupported signatures and noncanonical key fields',()=>{
 const a=args();a.attestations[0].privatePrayer='confidential';
 assert.throws(()=>inspectSignedAcceptance(a),/private fields/);
 const b=args();b.attestations[0].signatureBase64='###';
 assert.throws(()=>inspectSignedAcceptance(b),/Bad base64/);
 const c=args();c.trustRoot.password='secret';
 assert.throws(()=>inspectSignedAcceptance(c),/private fields/);
});
test('all nine visual cases remain separate explicit approval decisions',()=>{
 assert.equal(REQUIRED_VISUAL_DECISIONS.length,9);
 const signed=REQUIRED_VISUAL_DECISIONS.map((id,i)=>make({
   subjectId:id,nonce:'123e4567-e89b-42d3-a456-'+(426614174000+i),
 }));
 const r=inspectSignedAcceptance(args(signed));
 assert.equal(r.verifiedCryptographicSignatures,9);
 assert.deepEqual(r.requiredVisualDecisionsStillMissing,[]);
 assert.equal(r.humanReleaseAuthorityEstablished,false);
 assert.equal(r.releaseAuthorized,false);
});
test('a no-op rehearsal reports every open gate and cannot execute actions',()=>{
 const r=rehearseCandidate(rehearsal());
 assert.equal(r.missingOrFailedGateClaims.length,13);
 assert.equal(r.requiredVisualDecisionsStillMissing.length,9);
 assert.equal(r.mergePerformed,false);assert.equal(r.deploymentPerformed,false);
 assert.equal(r.recoveryPerformed,false);assert.equal(r.releaseAuthorized,false);
});
test('even claimed full gate completion does not authorize merge or deploy',()=>{
 const q=rehearsal();q.gateClaims=q.gateClaims.map(g=>({...g,claim:'CLAIMED_PASS'}));
 q.reviewInspection.requiredVisualDecisionsStillMissing=[];
 const r=rehearseCandidate(q);
 assert.deepEqual(r.missingOrFailedGateClaims,[]);
 assert.equal(r.sourceAuthorityIndependentlyAuthenticated,false);
 assert.equal(r.releaseAuthorized,false);assert.equal(r.publicationPerformed,false);
});
test('rejects changed original origin, path and unsafe schema downgrade',()=>{
 const a=rehearsal();a.proposedSiteUrl='https://new.example.test/devotion/';
 assert.throws(()=>rehearseCandidate(a),/across origins/);
 const b=rehearsal();b.proposedSiteUrl='https://old.example.test/elsewhere/';
 assert.throws(()=>rehearseCandidate(b),/app path/);
 const c=rehearsal();c.recoveryPlan.targetSchema=1;
 assert.throws(()=>rehearseCandidate(c),/No database downgrade/);
});
test('rejects destructive, unencrypted or wrongly scoped recovery claims',()=>{
 const a=rehearsal();a.recoveryPlan.destructiveSteps=['clear-site-data'];
 assert.throws(()=>rehearseCandidate(a),/No destructive recovery/);
 const b=rehearsal();b.recoveryPlan.backupOffDeviceEncrypted=false;
 assert.throws(()=>rehearseCandidate(b),/Encrypted off-device/);
 const c=rehearsal();c.recoveryPlan.candidateSiteUrl='https://new.example.test/devotion/';
 assert.throws(()=>rehearseCandidate(c),/across origins/);
});
test('rejects deployment or publication enabled even in otherwise passing evidence',()=>{
 const a=rehearsal();a.operatorDecision.deployAuthorized=true;
 assert.throws(()=>rehearseCandidate(a),/false/);
 const b=rehearsal();b.operatorDecision.mode='deploy';
 assert.throws(()=>rehearseCandidate(b),/dry-run-only/);
});
test('rejects missing, duplicate and unrelated gate claims or stale archive',()=>{
 const a=rehearsal();a.gateClaims.pop();assert.throws(()=>rehearseCandidate(a),/Missing release gates/);
 const b=rehearsal();b.gateClaims[1]={...b.gateClaims[0]};
 assert.throws(()=>rehearseCandidate(b),/Unknown or duplicate/);
 const c=rehearsal();c.archiveEvidence.sourceCommit=other;
 assert.throws(()=>rehearseCandidate(c),/Archive evidence stale/);
});


test('P15 CLI never reports authorization, returns nonzero and does not leak private input',async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
 const {join}=await import('node:path');const {tmpdir}=await import('node:os');
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const directory=mkdtempSync(join(tmpdir(),'mdd-p15-accept-'));
 try{
   const cli=fileURLToPath(new URL('./acceptance-cli.mjs',import.meta.url));
   const file=join(directory,'rehearsal.json');
   writeFileSync(file,JSON.stringify(rehearsal()));
   const check=()=>spawnSync(process.execPath,[cli,'rehearse',file],{encoding:'utf8'});
   const ok=check();assert.equal(ok.status,3,ok.stderr);
   assert.equal(JSON.parse(ok.stdout).releaseAuthorized,false);
   writeFileSync(file,JSON.stringify({...rehearsal(),privateJournal:'DO_NOT_LOG'}));
   const bad=check();assert.equal(bad.status,4);
   assert.ok(!bad.stderr.includes('DO_NOT_LOG'));
   assert.ok(!bad.stderr.includes(directory));
 }finally{rmSync(directory,{recursive:true,force:true})}
});
