import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessHandoff, assessPostRelease, makePendingHandoff } from './handoff.mjs';

const sha='a'.repeat(40), other='b'.repeat(40), hash='c'.repeat(64), badhash='d'.repeat(64);
const site='https://mdd.example.test/devotion/';
const sample=()=>makePendingHandoff(sha,site);
const withManifest=(b)=>{b.manifest={sourceCommit:sha,version:'1.3.0',
  artifact:'my-daily-devotion-1.3.0-web.zip',sha256:hash,databaseSchemaVersion:3,
  fileCount:2,files:{'index.html':hash,'build-info.json':badhash}};return b;};
const withCert=(b)=>{withManifest(b);b.certification={runId:123,artifactId:456,sourceCommit:sha,
  workflow:'Release Certification CI',branch:'main',event:'push',status:'completed',
  conclusion:'success',archiveSha256:hash};return b;};
const withObservation=(b)=>{withManifest(b);b.postReleaseObservation={
  sourceCommit:sha,siteUrl:site,buildInfo:{sourceCommit:sha,version:'1.3.0'},
  assets:{'index.html':hash,'build-info.json':badhash},databaseSchemaVersion:3,
  serviceWorkerScriptUrl:site+'sw.js',serviceWorkerScopeUrl:site};return b;};
const withClaims=(b)=>{b.acceptance.gates=b.acceptance.gates.map(g=>({...g,status:'passed',
  evidenceUrls:['https://github.com/example/repo/actions/runs/123'],reviewer:'verified-human',
  reviewedAt:'2026-10-09T17:00:00Z'}));
  b.reviewerClaims=b.acceptance.gates.map(g=>({gateId:g.id,sourceCommit:sha,
    reviewerHandle:'independent-person',reviewedAt:'2026-10-09T17:00:00Z',
    evidenceUrl:'https://github.com/example/repo/issues/54',decision:'accept'}));return b;};
test('pending handoff remains blocked even when structurally valid',()=>{
  const r=assessHandoff(sample(),sha);
  assert.deepEqual(r.missing,['release-manifest','exact-main-certification','p10-acceptance','post-release-observation']);
  assert.equal(r.releaseAuthorized,false);assert.equal(r.independentlyVerified,false);
});
test('rejects wrong exact source SHA',()=>{
  assert.throws(()=>makePendingHandoff('a',site),/40-character/);
  assert.throws(()=>assessHandoff(sample(),other),/Stale/);
  const b=withManifest(sample());b.manifest.sourceCommit=other;
  assert.throws(()=>assessHandoff(b,sha),/Manifest source commit/);
});
test('rejects origin/path changes and query tokens, even when claims say complete',()=>{
  const b=sample();b.candidateSiteUrl='https://other.example.test/devotion/';
  assert.throws(()=>assessHandoff(b,sha),/origin/);
  b.candidateSiteUrl='https://mdd.example.test/';
  assert.throws(()=>assessHandoff(b,sha),/path/);
  b.candidateSiteUrl=site+'?auth=my-token';
  assert.throws(()=>assessHandoff(b,sha),/query strings or bearer tokens/);
});
test('rejects unknown personal-data fields at handoff and reviewer level',()=>{
  const b=sample();b.prayer='PRIVATE';
  assert.throws(()=>assessHandoff(b,sha),/Unexpected field/);
  const c=sample();c.reviewerClaims=[{gateId:'privacy-nondisclosure-review',
    sourceCommit:sha,reviewerHandle:'independent-person',reviewedAt:'2026-10-09T17:00:00Z',
    evidenceUrl:'https://github.com/a/b/issues/1',decision:'accept',journal:'PRIVATE'}];
  assert.throws(()=>assessHandoff(c,sha),/Unexpected field/);
});
test('rejects missing assets, forged release hash, unsafe paths, unsafe downgrade',()=>{
  const b=withManifest(sample());b.manifest.fileCount=3;
  assert.throws(()=>assessHandoff(b,sha),/Incomplete file checksums/);
  b.manifest.fileCount=2;b.manifest.files['../secret']=hash;
  assert.throws(()=>assessHandoff(b,sha),/Incomplete file checksums/);
  delete b.manifest.files['build-info.json'];
  assert.throws(()=>assessHandoff(b,sha),/Missing site entrypoint|Noncanonical/);
  const c=withManifest(sample());c.manifest.databaseSchemaVersion=1;
  assert.throws(()=>assessHandoff(c,sha),/downgrade/);
  const d=withCert(sample());d.certification.archiveSha256=badhash;
  assert.throws(()=>assessHandoff(d,sha),/digest differs/);
});
test('certification requires exact successful main workflow, not a PR synthetic build',()=>{
  const b=withCert(sample());b.certification.event='pull_request';
  assert.throws(()=>assessHandoff(b,sha),/PR event/);
  b.certification.event='push';b.certification.branch='codex/p10';
  assert.throws(()=>assessHandoff(b,sha),/PR merge artifacts/);
  b.certification.branch='main';b.certification.conclusion='failure';
  assert.throws(()=>assessHandoff(b,sha),/success/);
  b.certification.conclusion='success';b.certification.sourceCommit=other;
  assert.throws(()=>assessHandoff(b,sha),/Certification source SHA/);
});
test('unsigned reviewer claims cannot fake acceptance or authority',()=>{
  const b=withClaims(withCert(withObservation(sample())));
  const r=assessHandoff(b,sha);
  assert.deepEqual(r.missing,[]);
  assert.equal(r.claimedAcceptanceComplete,true);
  assert.equal(r.claimedObservedAssetsMatch,true);
  assert.equal(r.unsignedReviewerClaims,14);
  assert.equal(r.releaseAuthorized,false);assert.equal(r.independentlyVerified,false);
  assert.equal(r.deploymentPerformed,false);
  assert.ok(!JSON.stringify(r).includes('independent-person'));
  assert.ok(!JSON.stringify(r).includes('https://github.com/example'));
});
test('duplicate/unknown reviewer claims and stale evidence are rejected',()=>{
  const b=sample();b.reviewerClaims=[{gateId:'unknown',sourceCommit:sha,
    reviewerHandle:'auditor',reviewedAt:'2026-10-09T17:00:00Z',
    evidenceUrl:'https://github.com/a/b',decision:'accept'}];
  assert.throws(()=>assessHandoff(b,sha),/Unknown gate/);
  b.reviewerClaims[0].gateId='p1-original-origin-migration';b.reviewerClaims[0].sourceCommit=other;
  assert.throws(()=>assessHandoff(b,sha),/Stale unsigned review/);
  b.reviewerClaims[0].sourceCommit=sha;b.reviewerClaims.push({...b.reviewerClaims[0]});
  assert.throws(()=>assessHandoff(b,sha),/Duplicate reviewer claim/);
});
test('post-release observations must use complete exact build bytes and scope',()=>{
  const b=withObservation(sample());
  assert.equal(assessPostRelease(b,b.postReleaseObservation).observationsMatch,true);
  b.postReleaseObservation.assets['index.html']=badhash;
  assert.throws(()=>assessPostRelease(b,b.postReleaseObservation),/hash mismatch/);
  b.postReleaseObservation.assets['index.html']=hash;
  b.postReleaseObservation.serviceWorkerScopeUrl='https://mdd.example.test/';
  assert.throws(()=>assessPostRelease(b,b.postReleaseObservation),/scope mismatch/);
});
test('post-release observation refuses cross-origin, missing bytes and wrong build identity',()=>{
  const b=withObservation(sample());
  b.postReleaseObservation.siteUrl='https://other.example.test/devotion/';
  assert.throws(()=>assessPostRelease(b,b.postReleaseObservation),/origin/);
  b.postReleaseObservation.siteUrl=site;b.postReleaseObservation.buildInfo.sourceCommit=other;
  assert.throws(()=>assessPostRelease(b,b.postReleaseObservation),/Build-info SHA/);
  b.postReleaseObservation.buildInfo.sourceCommit=sha;delete b.postReleaseObservation.assets['index.html'];
  assert.throws(()=>assessPostRelease(b,b.postReleaseObservation),/Missing\/extra/);
});
test('privacy-safe CLI returns nonzero even when every unsigned claim passes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'p11-'));
  const path=join(dir,'evidence.json'),cli=fileURLToPath(new URL('./handoff-cli.mjs',import.meta.url));
  try{
    writeFileSync(path,JSON.stringify(sample()));
    const run=()=>spawnSync(process.execPath,[cli,'assess',path,sha],{encoding:'utf8'});
    const pending=run();assert.equal(pending.status,2,pending.stderr);
    assert.equal(JSON.parse(pending.stdout).releaseAuthorized,false);
    writeFileSync(path,JSON.stringify(withClaims(withCert(withObservation(sample())))));
    const claimed=run();assert.equal(claimed.status,3,claimed.stderr);
    assert.equal(JSON.parse(claimed.stdout).releaseAuthorized,false);
    assert.ok(!claimed.stdout.includes('independent-person'));
  }finally{rmSync(dir,{recursive:true,force:true})}
});
test('invalid CLI metadata rejects generically without printing sensitive input',()=>{
  const dir=mkdtempSync(join(tmpdir(),'p11-private-'));
  const path=join(dir,'evidence.json'),cli=fileURLToPath(new URL('./handoff-cli.mjs',import.meta.url));
  try{
    const b=sample();b.prayerText='MY_PRIVATE_PRAYER';writeFileSync(path,JSON.stringify(b));
    const bad=spawnSync(process.execPath,[cli,'assess',path,sha],{encoding:'utf8'});
    assert.equal(bad.status,4);assert.ok(!bad.stderr.includes('MY_PRIVATE_PRAYER'));
    assert.ok(!bad.stdout.includes('MY_PRIVATE_PRAYER'));
  }finally{rmSync(dir,{recursive:true,force:true})}
});
