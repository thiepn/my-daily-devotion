import test from 'node:test';
import assert from 'node:assert/strict';
import { examineGithubRun, readGithubProvenance } from './provenance.mjs';
import { inspectReviewerIntake } from './reviewer.mjs';

const sha='a'.repeat(40), other='b'.repeat(40), jid=123456;
const names=['Unit, contracts and one production build','Reviewed journal image comparisons',
  'Browser chromium-1','Browser chromium-2','Browser chromium-3','Browser mobile-1',
  'Browser mobile-2','Browser firefox','Browser webkit','Browser offline',
  'Certify exact artifact and complete evidence'];
function bundle(){return {run:{id:jid,head_sha:sha,head_branch:'main',event:'push',name:'Release Certification CI',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success'},
  jobs:names.map((name,i)=>({name,id:i+1,run_id:jid,status:'completed',conclusion:'success'})),
  artifacts:[{name:'mdd-certified-release',id:321,workflow_run:{id:jid},expired:false,size_in_bytes:1000,digest:'sha256:'+'c'.repeat(64)}],sourceCommit:sha};}
function receipt(){return {receiptId:'123e4567-e89b-42d3-a456-426614174000',sourceCommit:sha,
  gateId:'android-chrome-physical-device',reviewerHandle:'independent-reviewer',
  reviewedAt:'2026-10-10T00:00:00Z',evidenceUrl:'https://github.com/example/repo/issues/1',
  evidenceSha256:'f'.repeat(64),decision:'accept',
  device:{platform:'android-chrome',claimedPhysical:true,scenarios:['offline-cold-start','ime-writing']}};}
const intake=()=>({sourceCommit:sha,receipts:[receipt()],priorReceiptIds:[]});
test('complete CI metadata cannot grant release or human signoff',()=>{
 const r=examineGithubRun(bundle());assert.equal(r.mandatoryJobsMatched,11);
 assert.equal(r.githubMetadataCrossChecked,true);assert.equal(r.releaseAuthorized,false);
 assert.equal(r.certifiedReleaseZipBytesCompared,false);assert.equal(r.independentlyApprovedHumanGates,false);
});
test('rejects wrong source SHA, PR branch and PR event',()=>{
 const a=bundle();a.run.head_sha=other;assert.throws(()=>examineGithubRun(a),/Source commit/);
 const b=bundle();b.run.head_branch='feature';assert.throws(()=>examineGithubRun(b),/PR artifacts/);
 const c=bundle();c.run.event='pull_request';assert.throws(()=>examineGithubRun(c),/Disallowed/);
});
test('rejects failed, incomplete, or wrong workflow',()=>{
 const a=bundle();a.run.conclusion='failure';assert.throws(()=>examineGithubRun(a),/failed run/);
 const b=bundle();b.run.path='.github/workflows/evil.yml';assert.throws(()=>examineGithubRun(b));
 const c=bundle();c.run.status='in_progress';assert.throws(()=>examineGithubRun(c));
});
test('rejects missing, duplicate, unsuccessful or foreign-run jobs',()=>{
 const a=bundle();a.jobs.pop();assert.throws(()=>examineGithubRun(a),/Missing or unexpected/);
 const b=bundle();b.jobs[1].name=b.jobs[0].name;assert.throws(()=>examineGithubRun(b),/Duplicate/);
 const c=bundle();c.jobs[7].conclusion='skipped';assert.throws(()=>examineGithubRun(c),/failed or skipped/);
 const d=bundle();d.jobs[4].run_id=999;assert.throws(()=>examineGithubRun(d),/another run/);
});
test('rejects missing, expired, duplicate or foreign certified archives',()=>{
 const a=bundle();a.artifacts=[];assert.throws(()=>examineGithubRun(a),/Missing or duplicated/);
 const b=bundle();b.artifacts[0].expired=true;assert.throws(()=>examineGithubRun(b),/expired/);
 const c=bundle();c.artifacts.push({...c.artifacts[0]});assert.throws(()=>examineGithubRun(c),/Missing or duplicated/);
 const d=bundle();d.artifacts[0].workflow_run.id=999;assert.throws(()=>examineGithubRun(d),/another run/);
});
test('GitHub transport digest is distinct from inner release archive digest',()=>{
 const a=bundle();a.artifacts[0].digest='bad';assert.throws(()=>examineGithubRun(a),/transport digest/);
 const b=bundle();delete b.artifacts[0].digest;const r=examineGithubRun(b);
 assert.equal(r.artifactTransportDigestAvailable,false);assert.equal(r.certifiedReleaseZipBytesCompared,false);
});
test('only fixed GET endpoints are used by API reader; no mutation',async()=>{
 const data=bundle(),requests=[];
 const fetcher=async(url,options)=>{requests.push({url,method:options.method});const suffix=new URL(url).pathname;
   const output=suffix.endsWith('/jobs')?{total_count:data.jobs.length,jobs:data.jobs}:
   suffix.endsWith('/artifacts')?{total_count:1,artifacts:data.artifacts}:data.run;
   return {ok:true,json:async()=>output};};
 const r=await readGithubProvenance({runId:jid,sourceCommit:sha,fetcher});
 assert.equal(r.githubMetadataCrossChecked,true);assert.equal(requests.length,3);
 assert.ok(requests.every(x=>x.method==='GET' && x.url.startsWith('https://api.github.com/repos/thiepn/my-daily-devotion/actions/runs/')));
});
test('API intake rejects truncated evidence and non-OK responses',async()=>{
 const data=bundle();const fetcher=async(url)=>({ok:true,json:async()=>url.includes('/jobs?')?{total_count:99,jobs:data.jobs}:
   url.includes('/artifacts?')?{total_count:1,artifacts:data.artifacts}:data.run});
 await assert.rejects(readGithubProvenance({runId:jid,sourceCommit:sha,fetcher}),/truncated job/);
 await assert.rejects(readGithubProvenance({runId:jid,sourceCommit:sha,fetcher:async()=>({ok:false})}),/request failed/);
});
test('valid reviewer intake is unverified claim only',()=>{
 const r=inspectReviewerIntake(intake());assert.equal(r.receiptClaims,1);
 assert.deepEqual(r.claimedPhysicalPlatforms,['android-chrome']);
 assert.equal(r.authenticatedHumanSignoffs,0);assert.equal(r.releaseAuthorized,false);
 assert.equal(r.identityVerified,false);assert.equal(r.physicalDeviceVerified,false);
 assert.ok(!JSON.stringify(r).includes('independent-reviewer'));
});
test('rejects replay across prior IDs and duplicates within a batch',()=>{
 const a=intake();a.priorReceiptIds=[a.receipts[0].receiptId];assert.throws(()=>inspectReviewerIntake(a),/replayed/);
 const b=intake();b.receipts.push({...b.receipts[0]});assert.throws(()=>inspectReviewerIntake(b),/replayed/);
});
test('rejects stale reviewer SHA, invalid nonce and unknown gate',()=>{
 const a=intake();a.receipts[0].sourceCommit=other;assert.throws(()=>inspectReviewerIntake(a),/Stale/);
 const b=intake();b.receipts[0].receiptId='incrementing-1';assert.throws(()=>inspectReviewerIntake(b),/Version-4/);
 const c=intake();c.receipts[0].gateId='future-authorization';assert.throws(()=>inspectReviewerIntake(c),/Unknown/);
});
test('rejects private data, device IDs, token URLs and wrong hashes',()=>{
 const a=intake();a.receipts[0].journalText='PRIVATE';assert.throws(()=>inspectReviewerIntake(a),/private evidence/);
 const b=intake();b.receipts[0].device.deviceId='PERSON';assert.throws(()=>inspectReviewerIntake(b),/private evidence/);
 const c=intake();c.receipts[0].evidenceUrl+='?token=private';assert.throws(()=>inspectReviewerIntake(c),/Unsafe evidence/);
 const d=intake();d.receipts[0].evidenceSha256='wrong';assert.throws(()=>inspectReviewerIntake(d),/Evidence digest/);
});
test('rejects emulated devices and duplicate or unsupported scenarios',()=>{
 const a=intake();a.receipts[0].device.claimedPhysical=false;assert.throws(()=>inspectReviewerIntake(a),/emulator/);
 const b=intake();b.receipts[0].device.scenarios=['offline-cold-start','offline-cold-start'];assert.throws(()=>inspectReviewerIntake(b),/Duplicated scenarios/);
 const c=intake();c.receipts[0].device.platform='ios';assert.throws(()=>inspectReviewerIntake(c),/Unknown device/);
});


test('review CLI accepts only privacy-safe claims and never returns approval success', async()=>{
  const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
  const {join}=await import('node:path');
  const {tmpdir}=await import('node:os');
  const {spawnSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  const folder=mkdtempSync(join(tmpdir(),'p13-claims-'));
  try{
    const packet=join(folder,'packet.json'),history=join(folder,'history.json');
    writeFileSync(packet,JSON.stringify({sourceCommit:sha,receipts:[receipt()]}));
    writeFileSync(history,JSON.stringify({sourceCommit:sha,receiptIds:[]}));
    const cli=fileURLToPath(new URL('./evidence-cli.mjs',import.meta.url));
    const run=()=>spawnSync(process.execPath,[cli,'review',packet,history,sha],{encoding:'utf8'});
    const good=run();assert.equal(good.status,3,good.stderr);
    assert.equal(JSON.parse(good.stdout).releaseAuthorized,false);
    assert.ok(!good.stdout.includes('independent-reviewer'));
    writeFileSync(packet,JSON.stringify({sourceCommit:sha,receipts:[receipt()],journal:'MY_SECRET_PRAYER'}));
    const bad=run();assert.equal(bad.status,4);
    assert.ok(!bad.stderr.includes('MY_SECRET_PRAYER'));
    assert.ok(!bad.stderr.includes(packet));
  }finally{rmSync(folder,{recursive:true,force:true});}
});
