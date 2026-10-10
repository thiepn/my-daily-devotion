import { lstat, readFile } from 'node:fs/promises';
import { inspectSignedAcceptance } from './attestations.mjs';
import { rehearseCandidate } from './rehearsal.mjs';

const SHA=/^[0-9a-f]{40}$/;
async function readSmallJson(path) {
  const stat=await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size<=0 || stat.size>2*1024*1024)
    throw new Error('Invalid evidence file');
  return JSON.parse(await readFile(path,'utf8'));
}
function exact(obj,keys) {
  if(!obj || typeof obj!=='object' || Array.isArray(obj) ||
     Object.keys(obj).some(k=>!keys.includes(k)))throw new Error('Unsafe metadata fields');
}
async function main() {
  const [mode,...args]=process.argv.slice(2);
  if(mode==='attest' && args.length===6) {
    const [trustPath,packetPath,noncePath,authorsPath,sha,atTime]=args;
    if(!SHA.test(sha))throw new Error('Invalid source SHA');
    const [trustRoot,packet,history,authors]=await Promise.all([
      readSmallJson(trustPath),readSmallJson(packetPath),readSmallJson(noncePath),readSmallJson(authorsPath),
    ]);
    exact(packet,['sourceCommit','attestations']);
    exact(history,['sourceCommit','previouslyUsedNonces']);
    exact(authors,['sourceCommit','codeAuthorHandles']);
    if([packet,history,authors].some(x=>x.sourceCommit!==sha))throw new Error('Stale signing input');
    const report=inspectSignedAcceptance({sourceCommit:sha,trustRoot,
      attestations:packet.attestations,previouslyUsedNonces:history.previouslyUsedNonces,
      codeAuthorHandles:authors.codeAuthorHandles,now:atTime});
    // Never emit key data, reviewer identifiers, full signed statements or private records.
    console.log(JSON.stringify({
      sourceCommit:sha,verifiedCryptographicSignatures:report.verifiedCryptographicSignatures,
      requiredVisualDecisionsStillMissing:report.requiredVisualDecisionsStillMissing,
      independentTrustProvisioningVerified:false,revocationStatusIndependentlyVerified:false,
      humanReleaseAuthorityEstablished:false,releaseAuthorized:false,
    },null,2));
    process.exitCode=3;
    return;
  }
  if(mode==='rehearse' && args.length===1){
    const input=await readSmallJson(args[0]);
    exact(input,['sourceCommit','originalSiteUrl','proposedSiteUrl','archiveEvidence',
      'reviewInspection','gateClaims','recoveryPlan','operatorDecision']);
    const report=rehearseCandidate(input);
    console.log(JSON.stringify(report,null,2));
    process.exitCode=3;
    return;
  }
  throw new Error('Invalid arguments');
}
try {await main();}
catch {
  console.error('P15: blocked. Validate source evidence and obtain independent human review before any release.');
  process.exitCode=4;
}
