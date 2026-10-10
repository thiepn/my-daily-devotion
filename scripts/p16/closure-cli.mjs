import { lstat, readFile } from 'node:fs/promises';
import { verifyReceiptHistory } from './receipt-history.mjs';
import { inspectOperatorClosure } from './operator.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
async function readEvidence(path) {
  const st=await lstat(path);
  if(!st.isFile() || st.isSymbolicLink() || st.size<1 || st.size>2*1024*1024)
    throw new Error('Invalid local evidence');
  return JSON.parse(await readFile(path,'utf8'));
}
function shape(o,keys) {
  if(!o || typeof o!=='object' || Array.isArray(o) ||
    Object.keys(o).some(k=>!keys.includes(k)))throw new Error('Unexpected/private fields');
}
async function main() {
  const [mode,path,sha,now]=process.argv.slice(2);
  if(!['history','rehearse'].includes(mode) || !path || !SHA.test(sha ?? '') ||
    !now || process.argv.length!==6)throw new Error('Invalid arguments');
  // These independent operator-supplied pins MUST NOT be sourced from the same
  // packet whose signatures are being checked or stored in the public repo.
  const expectedRootSha256=process.env.MDD_CUSTODY_ROOT_SHA256;
  const anchorDigest=process.env.MDD_TRUSTED_LEDGER_DIGEST;
  const anchorSequenceRaw=process.env.MDD_TRUSTED_LEDGER_SEQUENCE;
  const custodyRevisionRaw=process.env.MDD_MIN_TRUSTED_CUSTODY_REVISION;
  if(!HASH.test(expectedRootSha256??'') || !HASH.test(anchorDigest??'') ||
    !/^(0|[1-9]\d{0,14})$/.test(anchorSequenceRaw??'') ||
    !/^[1-9]\d{0,14}$/.test(custodyRevisionRaw??''))throw new Error('Missing external trust anchor');
  const input=await readEvidence(path);
  shape(input,['sourceCommit','rootPublicSpkiDerBase64','manifest','records','checkpoint',
    'previouslyUsedNonces','codeAuthorHandles','originalSiteUrl',
    'archiveEvidence','deviceClaims','recoveryPlan','gateClaims']);
  if(input.sourceCommit!==sha)throw new Error('Source SHA differs');
  const verifiedHistory=verifyReceiptHistory({
    sourceCommit:sha,rootPublicSpkiDerBase64:input.rootPublicSpkiDerBase64,
    expectedRootSha256,minimumTrustedRevision:Number(custodyRevisionRaw),manifest:input.manifest,
    trustedPreviousAnchor:{sequence:Number(anchorSequenceRaw),digest:anchorDigest},
    records:input.records,checkpoint:input.checkpoint,
    previouslyUsedNonces:input.previouslyUsedNonces??[],
    codeAuthorHandles:input.codeAuthorHandles??[],currentTime:now,
  });
  if(mode==='history') {
    console.log(JSON.stringify({sourceCommit:sha,verifiedReceiptSignatures:verifiedHistory.verifiedReceiptSignatures,
      currentLedgerSequence:verifiedHistory.sequence,
      receiptChainSignatureValid:true,independentTrustCustodyVerified:false,
      realDeviceVerified:false,releaseAuthorized:false},null,2));
    process.exitCode=3;return;
  }
  const result=inspectOperatorClosure({
    sourceCommit:sha,verifiedHistory,historyRecords:input.records,
    originalSiteUrl:input.originalSiteUrl,
    archiveEvidence:input.archiveEvidence,
    deviceClaims:input.deviceClaims??[],recoveryPlan:input.recoveryPlan,
    gateClaims:input.gateClaims,
  });
  console.log(JSON.stringify(result,null,2));
  process.exitCode=3;
}
try {await main();}
catch {
  // Reject without printing private reviewer fields, local paths, keys or supplied URLs.
  console.error('P16: inspection blocked; independently verify root custody, receipt history and all release gates.');
  process.exitCode=4;
}
