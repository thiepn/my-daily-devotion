import { readFile, writeFile } from 'node:fs/promises';
import { assessHandoff, makePendingHandoff } from './handoff.mjs';

// Inspection only; no network, secrets, authorization, remote changes or publication.
async function main() {
  const [op, ...args] = process.argv.slice(2);
  if(op==='template' && args.length===3) {
    const [sha, originalSiteUrl, output]=args;
    const ledger=makePendingHandoff(sha,originalSiteUrl);
    await writeFile(output,JSON.stringify(ledger,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log('P11 handoff template created with all evidence pending. No signoff recorded.');
    return;
  }
  if(op==='assess' && args.length===2) {
    const [input,expectedSha]=args;
    const bundle=JSON.parse(await readFile(input,'utf8'));
    const status=assessHandoff(bundle,expectedSha);
    console.log(JSON.stringify(status,null,2));
    // Nonzero both for missing evidence and for fully claimed but unverified evidence.
    process.exitCode=status.missing.length?2:3;
    return;
  }
  throw new Error('usage');
}
try { await main(); }
catch {
  // Never print rejected JSON, URLs, authentication tokens or personal journals.
  console.error('P11 rejected an invalid handoff or incorrect arguments; see the runbook.');
  process.exitCode=4;
}
