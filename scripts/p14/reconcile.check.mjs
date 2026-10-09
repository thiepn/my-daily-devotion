import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectReviewSnapshot, readGithubReviewSnapshot } from './github-reviews.mjs';
import { reconcileEvidence } from './reconcile.mjs';

const sha='a'.repeat(40), other='b'.repeat(40), reviewedAt='2026-10-10T00:02:00Z';
const id='123e4567-e89b-42d3-a456-426614174000';
const hash='f'.repeat(64);
const message='Review covers test evidence; content requires independent visual decision.';
const bodyHash=createHash('sha256').update(message).digest('hex');
function github(){
  return {pull:{number:53,head:{sha},user:{login:'author'}},
    reviews:[{id:123,user:{login:'external-reviewer'},commit_id:sha,state:'APPROVED',
      submitted_at:reviewedAt,body:message}],
    commits:[{author:{login:'author'},committer:{login:'author'}}],
    expectedSha:sha,expectedPr:53};
}
function packet(){
  return {sourceCommit:sha,receipts:[{receiptId:id,sourceCommit:sha,
    gateId:'p8-independent-visual-approval',reviewerHandle:'external-reviewer',
    reviewedAt,evidenceUrl:'https://github.com/thiepn/my-daily-devotion/pull/53',
    evidenceSha256:hash,decision:'accept'}]};
}
function params(){
  return {sourceCommit:sha,receiptPacket:packet(),priorReceiptIds:[],
    githubReviewSnapshot:inspectReviewSnapshot(github()),
    sourceLinks:[{receiptId:id,reviewId:123,reviewBodySha256:bodyHash}]};
}
function recovery(){
  return {sourceCommit:sha,existingSiteUrl:'https://old.example.test/devotion/',
    candidateSiteUrl:'https://old.example.test/devotion/',
    installedSchema:3,targetSchema:3,action:'fresh-compatible-profile-restore',
    destructiveStep:false,backupFormat:'portable-v1-encrypted',encryptedOffDevice:true,
    restoreClaimed:true,evidenceSha256:hash};
}
test('GitHub current-head review source is corroborated but never auto-approves visuals',()=>{
 const s=inspectReviewSnapshot(github());assert.equal(s.entries.length,1);
 assert.equal(s.entries[0].independentOfKnownCodeAuthors,true);
 assert.equal(s.entries[0].onExpectedHead,true);
 assert.equal(s.visualApprovalVerified,false);assert.equal(s.releaseAuthorized,false);
});
test('source rejects stale head, unknown state, duplicate review IDs and large messages',()=>{
 const a=github();a.pull.head.sha=other;assert.throws(()=>inspectReviewSnapshot(a),/head changed/);
 const b=github();b.reviews[0].state='PENDING';assert.throws(()=>inspectReviewSnapshot(b),/Unrecognized/);
 const c=github();c.reviews.push({...c.reviews[0]});assert.throws(()=>inspectReviewSnapshot(c),/Duplicate/);
 const d=github();d.reviews[0].body='x'.repeat(20001);assert.throws(()=>inspectReviewSnapshot(d),/Oversized/);
});
test('self-review does not prove independent code review',()=>{
 const a=github();a.reviews[0].user.login='author';
 const s=inspectReviewSnapshot(a);assert.equal(s.entries[0].independentOfKnownCodeAuthors,false);
});
test('fixed GET-only GitHub source verification rejects pagination and failed responses',async()=>{
 const a=github(),urls=[];
 const fetcher=async(url,options)=>{
   urls.push({url,method:options.method,redirect:options.redirect});
   const value=url.includes('/reviews?')?a.reviews:url.includes('/commits?')?a.commits:a.pull;
   return {ok:true,headers:{get:()=>null},json:async()=>value};
 };
 const s=await readGithubReviewSnapshot({prNumber:53,expectedSha:sha,fetcher});
 assert.equal(s.entries.length,1);assert.equal(urls.length,3);
 assert.ok(urls.every(x=>x.method==='GET' && x.redirect==='error' && x.url.startsWith('https://api.github.com/repos/thiepn/my-daily-devotion/pulls/53')));
 const paged=async()=>({ok:true,headers:{get:()=>'<https://api.github.com/...>; rel="next"'},json:async()=>[]});
 await assert.rejects(readGithubReviewSnapshot({prNumber:53,expectedSha:sha,fetcher:paged}),/truncated/);
 await assert.rejects(readGithubReviewSnapshot({prNumber:53,expectedSha:sha,fetcher:async()=>({ok:false})}),/request failed/);
});
test('reconcile source matches without authenticating review intent, identity or release',()=>{
 const r=reconcileEvidence(params());
 assert.equal(r.githubRecordsMatched,1);
 assert.equal(r.independentCodeReviewSourceClaims,1);
 assert.equal(r.unsignedReceiptClaims,1);
 assert.equal(r.visualApprovalVerified,false);
 assert.equal(r.operatorApprovalVerified,false);assert.equal(r.releaseAuthorized,false);
 assert.equal(r.physicalDeviceVerified,false);
 assert.ok(!JSON.stringify(r).includes('external-reviewer'));
});
test('receipt replay and duplicated source links fail closed',()=>{
 const a=params();a.priorReceiptIds=[id];assert.throws(()=>reconcileEvidence(a),/replayed/);
 const b=params();b.sourceLinks.push({...b.sourceLinks[0]});
 assert.throws(()=>reconcileEvidence(b),/Duplicate source-linked/);
});
test('stale or mismatched signed-source metadata and unsupported fields fail',()=>{
 const a=params();a.sourceLinks[0].reviewBodySha256=hash;
 assert.throws(()=>reconcileEvidence(a),/Review body digest differs/);
 const b=params();b.receiptPacket.receipts[0].reviewerHandle='other';
 assert.throws(()=>reconcileEvidence(b),/Receipt reviewer/);
 const c=params();c.githubReviewSnapshot.sourceCommit=other;
 assert.throws(()=>reconcileEvidence(c),/Stale GitHub/);
 const d=params();d.sourceLinks[0].privateJournal='PRIVATE';
 assert.throws(()=>reconcileEvidence(d),/personal-data/);
});
test('missing GitHub review returns unresolved source rather than fabricated approval',()=>{
 const a=params();a.githubReviewSnapshot.entries=[];
 const r=reconcileEvidence(a);
 assert.equal(r.githubRecordsMatched,0);assert.equal(r.missingGithubSourceRecords,1);
 assert.equal(r.visualApprovalVerified,false);
});
test('scenario claims cannot substitute for physical Android and TalkBack testing',()=>{
 const a=params();a.receiptPacket.receipts[0].device={
   platform:'android-chrome',claimedPhysical:true,scenarios:['offline-cold-start','ime-writing']};
 const r=reconcileEvidence(a);
 assert.deepEqual(r.deviceScenarioClaims['android-chrome'].missingRequiredScenarios,
   ['background-resume','storage-pressure','service-worker-update']);
 assert.equal(r.deviceScenarioClaims['android-chrome'].physicalDeviceVerified,false);
 assert.equal(r.deviceScenarioClaims['android-talkback'].claimedScenarios,0);
});
test('safe encrypted forward recovery remains unverified and performs no action',()=>{
 const a=params();a.recoveryPlan=recovery();
 const r=reconcileEvidence(a);
 assert.equal(r.recoveryClaim.supplied,true);
 assert.equal(r.recoveryClaim.claimedRestore,true);
 assert.equal(r.recoveryClaim.rehearsed,false);assert.equal(r.recoveryClaim.actionsPerformed,false);
});
test('rejects schema downgrade, origin move, destructive recovery and nonencrypted backup',()=>{
 const a=params();a.recoveryPlan=recovery();a.recoveryPlan.targetSchema=1;
 assert.throws(()=>reconcileEvidence(a),/downgrade/);
 const b=params();b.recoveryPlan=recovery();b.recoveryPlan.candidateSiteUrl='https://new.example.test/devotion/';
 assert.throws(()=>reconcileEvidence(b),/across origins/);
 const c=params();c.recoveryPlan=recovery();c.recoveryPlan.destructiveStep=true;
 assert.throws(()=>reconcileEvidence(c),/Destructive/);
 const d=params();d.recoveryPlan=recovery();d.recoveryPlan.backupFormat='plaintext';
 assert.throws(()=>reconcileEvidence(d),/portable-v1-encrypted/);
});
test('rejects private record fields, personal devices, tokens and stale receipts',()=>{
 const a=params();a.receiptPacket.receipts[0].deviceId='PHONE';
 assert.throws(()=>reconcileEvidence(a),/private evidence field/);
 const b=params();b.receiptPacket.receipts[0].evidenceUrl+='?token=private';
 assert.throws(()=>reconcileEvidence(b),/Unsafe evidence URL/);
 const c=params();c.receiptPacket.sourceCommit=other;
 assert.throws(()=>reconcileEvidence(c),/Stale receipt packet/);
});
