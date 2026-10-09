import { readFile, lstat } from 'node:fs/promises';
import { readGithubProvenance } from './provenance.mjs';
import { inspectReviewerIntake } from './reviewer.mjs';

const SHA=/^[0-9a-f]{40}$/;
async function jsonFile(path) {
  const stat=await lstat(path);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size<=0 || stat.size>1024*1024)
    throw new Error('Unsafe evidence file');
  return JSON.parse(await readFile(path,'utf8'));
}
function shape(obj, keys) {
  if(!obj || typeof obj!=='object' || Array.isArray(obj) ||
    Object.keys(obj).some(k=>!keys.includes(k))) throw new Error('Invalid metadata');
}
async function main() {
  const [action,...args]=process.argv.slice(2);
  if(action==='github' && args.length===2) {
    const [id,sha]=args;
    if(!/^[1-9]\d{0,14}$/.test(id) || !SHA.test(sha)) throw new Error('Invalid SHA or run');
    const result=await readGithubProvenance({
      runId:Number(id),sourceCommit:sha,token:process.env.GITHUB_TOKEN||undefined,
    });
    console.log(JSON.stringify(result,null,2));
    process.exitCode=3; // API metadata is not release approval or package-byte verification.
    return;
  }
  if(action==='review' && args.length===3) {
    const [packetFile,historyFile,sha]=args;
    if(!SHA.test(sha)) throw new Error('Invalid SHA');
    const [packet,history]=await Promise.all([jsonFile(packetFile),jsonFile(historyFile)]);
    shape(packet,['sourceCommit','receipts']);
    shape(history,['sourceCommit','receiptIds']);
    if(packet.sourceCommit!==sha || history.sourceCommit!==sha) throw new Error('Stale reviewer receipt set');
    const result=inspectReviewerIntake({sourceCommit:sha,receipts:packet.receipts,priorReceiptIds:history.receiptIds});
    console.log(JSON.stringify(result,null,2));
    process.exitCode=3; // Even valid unsigned receipts cannot be an approval.
    return;
  }
  throw new Error('Usage: github RUN_ID SOURCE_SHA | review PACKET_JSON HISTORY_JSON SOURCE_SHA');
}
try { await main(); }
catch {
  // Never echo rejected JSON, local paths, reviewer handles, authentication tokens or journal data.
  console.error('P13: failed closed. Provenance or reviewer evidence requires independent review.');
  process.exitCode=4;
}
