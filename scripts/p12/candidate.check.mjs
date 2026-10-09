import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { artifactDigest } from '../certification/evidence.mjs';
import { makePendingHandoff } from '../p11/handoff.mjs';
import { inspectCandidate } from './candidate.mjs';

const sha='a'.repeat(40), other='b'.repeat(40), site='https://existing.example.test/devotion/';
const enc=new TextEncoder(), hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function candidate() {
  const version='1.3.0', files={
    'index.html':enc.encode('<!doctype html><html><body>TEST</body></html>'),
    'build-info.json':enc.encode(JSON.stringify({sourceCommit:sha,version})),
  };
  const deploymentHashes=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)]));
  const packed=Object.fromEntries(Object.entries(files).map(([p,b])=>['my-daily-devotion/'+p,b]));
  const releaseArchive=zipSync(packed,{level:9});
  const sha256=hash(releaseArchive), digest=artifactDigest(deploymentHashes);
  const releaseManifest={
    product:'My Daily Devotion',version,artifact:'my-daily-devotion-'+version+'-web.zip',
    sourceCommit:sha,sha256,databaseSchemaVersion:3,fileCount:2,
    unpackedBytes:Object.values(files).reduce((n,b)=>n+b.byteLength,0),
    archiveBytes:releaseArchive.byteLength,
  };
  const verificationSummary={
    sourceCommit:sha,version,databaseSchema:3,unit:{passed:356,failed:0,skipped:0},
    browser:{expected:1158,unexpected:0,flaky:0,skipped:0},
    visual:{expected:526,unexpected:0,flaky:0,skipped:0},
    artifactDigest:digest,packageSha256:sha256,deploymentFileCount:2,
  };
  const buildEvidence={sourceCommit:sha,files:{...deploymentHashes},artifactDigest:digest};
  return {expectedSha:sha,releaseManifest,deploymentHashes,verificationSummary,
    buildEvidence,releaseArchive};
}
const runClaim=()=>({status:'completed',conclusion:'success',name:'Release Certification CI',
  path:'.github/workflows/ci.yml',head_branch:'main',event:'push',head_sha:sha});
const throws=(candidate,expression)=>assert.throws(()=>inspectCandidate(candidate),expression);

test('genuine offline archive verifies all actual bytes without claiming release approval',()=>{
  const r=inspectCandidate(candidate());
  assert.equal(r.localArtifactHashesVerified,true);assert.equal(r.fileCount,2);
  assert.equal(r.independentlyVerifiedReleaseCertification,false);
  assert.equal(r.humanAcceptanceVerified,false);assert.equal(r.releaseAuthorized,false);
  assert.equal(r.deploymentPerformed,false);
  assert.equal(r.certificationClaimPresent,false);
});
test('rejects swapped source commit in manifest, build and summary',()=>{
  const a=candidate();a.releaseManifest.sourceCommit=other;throws(a,/Release manifest SHA mismatch/);
  const b=candidate();b.buildEvidence.sourceCommit=other;throws(b,/Tested build source SHA mismatch/);
  const c=candidate();c.verificationSummary.sourceCommit=other;throws(c,/Verification summary SHA mismatch/);
});
test('rejects archive byte tampering independently of JSON metadata claims',()=>{
  const a=candidate();a.releaseArchive=a.releaseArchive.slice();
  a.releaseArchive[10]^=0xff;throws(a,/Downloaded archive is not the tested release/);
});
test('rejects wrong archive digest, archive byte count and unpacked size',()=>{
  const a=candidate();a.releaseManifest.sha256='f'.repeat(64);throws(a,/Downloaded archive is not the tested release/);
  const b=candidate();b.releaseManifest.archiveBytes--;throws(b,/Archive length mismatch/);
  const c=candidate();c.releaseManifest.unpackedBytes--;throws(c,/Unpacked archive byte length mismatch/);
});
test('requires exact physical database schema and release filename',()=>{
  const a=candidate();a.releaseManifest.databaseSchemaVersion=2; a.verificationSummary.databaseSchema=2;
  throws(a,/downgrade/);
  const b=candidate();b.releaseManifest.artifact='other.zip';throws(b,/Unexpected artifact identity/);
});
test('rejects build/release file inventory differences and digest mismatch',()=>{
  const a=candidate();a.buildEvidence.files['index.html']='0'.repeat(64);throws(a,/Build-tested assets/);
  const b=candidate();b.buildEvidence.artifactDigest='0'.repeat(64);throws(b,/Build provenance digest/);
  const c=candidate();c.verificationSummary.artifactDigest='0'.repeat(64);throws(c,/Certification summary/);
});
test('rejects missing/extra assets or noncanonical archive file references',()=>{
  const a=candidate();delete a.deploymentHashes['index.html'];throws(a,/Missing or extra release files/);
  const b=candidate();b.deploymentHashes['../key']='c'.repeat(64);b.releaseManifest.fileCount=3;
  throws(b,/Unsafe release asset path/);
  const c=candidate();c.deploymentHashes['bad%2Fname']='d'.repeat(64);
  c.releaseManifest.fileCount=3;throws(c,/Unsafe release asset path/);
});
test('rejects passing summary claims with visual failures, skipped or flaky browser evidence',()=>{
  const a=candidate();a.verificationSummary.visual.unexpected=9;
  throws(a,/Expected values to be strictly equal/);
  const b=candidate();b.verificationSummary.browser.flaky=1;
  throws(b,/Expected values to be strictly equal/);
  const c=candidate();c.verificationSummary.unit.failed=1;
  throws(c,/Expected values to be strictly equal/);
});
test('a PR synthetic build cannot become a certified main deployment',()=>{
  const a=candidate();a.certificationRun={...runClaim(),event:'pull_request'};
  throws(a,/PR artifacts cannot be deployed/);
  const b=candidate();b.certificationRun={...runClaim(),head_branch:'codex/p11'};
  throws(b,/Deploy only a certified main commit/);
  const c=candidate();c.certificationRun={...runClaim(),head_sha:other};
  throws(c,/Certification is not for the selected main commit/);
});
test('even claimed successful main certification is explicitly not authenticated or authorized',()=>{
  const a=candidate();a.certificationRun=runClaim();
  const r=inspectCandidate(a);assert.equal(r.certificationClaimPresent,true);
  assert.equal(r.independentlyVerifiedReleaseCertification,false);
  assert.equal(r.releaseAuthorized,false);
});
test('P11 handoff may be correlated but cannot replace artifact byte verification',()=>{
  const a=candidate();const h=makePendingHandoff(sha,site);
  h.manifest={sourceCommit:sha,version:a.releaseManifest.version,artifact:a.releaseManifest.artifact,
    sha256:a.releaseManifest.sha256,databaseSchemaVersion:3,fileCount:2,files:a.deploymentHashes};
  a.p11Handoff=h;
  const r=inspectCandidate(a);
  assert.equal(r.handoffClaimsPresent,true);assert.equal(r.handoffClaimsComplete,false);
  assert.equal(r.releaseAuthorized,false);
  const b=candidate();const forged=structuredClone(h);
  forged.manifest.sha256='f'.repeat(64);b.p11Handoff=forged;
  throws(b,/Handoff archive differs from actual archive/);
});
test('rejects a P11 handoff from another source or origin',()=>{
  const a=candidate();const h=makePendingHandoff(sha,site);
  h.manifest={sourceCommit:sha,version:a.releaseManifest.version,artifact:a.releaseManifest.artifact,
    sha256:a.releaseManifest.sha256,databaseSchemaVersion:3,fileCount:2,files:a.deploymentHashes};
  h.acceptance.sourceCommit=other;a.p11Handoff=h;
  throws(a,/Ledger belongs to another source commit/);
});


test('offline CLI confirms bytes but always exits nonzero, and rejects changed SHA256SUMS',async()=>{
  const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
  const {join}=await import('node:path');
  const {tmpdir}=await import('node:os');
  const {spawnSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  const directory=mkdtempSync(join(tmpdir(),'p12-candidate-'));
  try{
    const data=candidate(), name=data.releaseManifest.artifact;
    writeFileSync(join(directory,'release-manifest.json'),JSON.stringify(data.releaseManifest));
    writeFileSync(join(directory,'deployment-hashes.json'),JSON.stringify(data.deploymentHashes));
    writeFileSync(join(directory,'verification-summary.json'),JSON.stringify(data.verificationSummary));
    writeFileSync(join(directory,'build-evidence.json'),JSON.stringify(data.buildEvidence));
    writeFileSync(join(directory,name),data.releaseArchive);
    writeFileSync(join(directory,'SHA256SUMS'),data.releaseManifest.sha256+'  '+name+'\n');
    const run=()=>spawnSync(process.execPath,[fileURLToPath(new URL('./candidate-cli.mjs',import.meta.url)),directory,sha],{encoding:'utf8'});
    const good=run();
    assert.equal(good.status,3,good.stderr);
    const report=JSON.parse(good.stdout);
    assert.equal(report.localArtifactHashesVerified,true);
    assert.equal(report.releaseAuthorized,false);
    writeFileSync(join(directory,'SHA256SUMS'),'tampered');
    const bad=run();
    assert.equal(bad.status,4);
    assert.ok(!bad.stderr.includes(directory));
  }finally{rmSync(directory,{recursive:true,force:true})}
});
