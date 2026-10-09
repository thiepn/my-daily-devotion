import { lstat, readFile } from 'node:fs/promises';
import { readGithubReviewSnapshot } from './github-reviews.mjs';
import { reconcileEvidence } from './reconcile.mjs';

const SHA = /^[0-9a-f]{40}$/;
async function safeJson(path) {
  const st = await lstat(path);
  if (!st.isFile() || st.isSymbolicLink() || st.size < 1 || st.size > 1024*1024) {
    throw new Error('Unsafe evidence input');
  }
  return JSON.parse(await readFile(path, 'utf8'));
}
function exact(data, fields) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(k => !fields.includes(k))) throw new Error('Unexpected evidence fields');
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'github' && args.length === 2) {
    const [pr, sha] = args;
    if (!/^[1-9]\d{0,6}$/.test(pr) || !SHA.test(sha)) throw new Error('Invalid request');
    const result = await readGithubReviewSnapshot({
      prNumber: Number(pr), expectedSha: sha, token: process.env.GITHUB_TOKEN || undefined,
    });
    console.log(JSON.stringify({
      sourceCommit:sha, pullNumber:Number(pr), reviewRecords:result.entries.length,
      independentCodeReviewSourceClaims:result.entries.filter(e=>e.onExpectedHead &&
        e.independentOfKnownCodeAuthors && e.state==='APPROVED').length,
      visualApprovalVerified:false,operatorApprovalVerified:false,releaseAuthorized:false,
    },null,2));
    process.exitCode = 3;
    return;
  }
  if (action === 'reconcile' && args.length === 6) {
    const [packetFile, historyFile, sourceFile, linksFile, recoveryFile, sha] = args;
    if (!SHA.test(sha)) throw new Error('Invalid SHA');
    const [packet, history, snapshot, links, recovery] = await Promise.all([
      safeJson(packetFile), safeJson(historyFile), safeJson(sourceFile),
      safeJson(linksFile), recoveryFile==='none'?Promise.resolve(null):safeJson(recoveryFile),
    ]);
    exact(packet,['sourceCommit','receipts']);
    exact(history,['sourceCommit','receiptIds']);
    exact(snapshot,['sourceCommit','pullNumber','entries','githubResponseStructurallyChecked',
      'visualApprovalVerified','deviceAcceptanceVerified','operatorDecisionVerified','releaseAuthorized']);
    if (history.sourceCommit!==sha || snapshot.sourceCommit!==sha) throw new Error('Stale history');
    const status = reconcileEvidence({sourceCommit:sha,receiptPacket:packet,
      priorReceiptIds:history.receiptIds,githubReviewSnapshot:snapshot,sourceLinks:links,
      recoveryPlan:recovery});
    console.log(JSON.stringify(status,null,2));
    process.exitCode = 3; // No unsigned packet can authorize a release.
    return;
  }
  throw new Error('Invalid command arguments');
}
try { await main(); }
catch {
  // Never echo file names, token-bearing URLs, private journal text or reviewer identities.
  console.error('P14: evidence review blocked; independently authenticate source and human decisions.');
  process.exitCode = 4;
}
