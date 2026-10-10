import {lstat,readFile} from 'node:fs/promises';
import {inspectIndependentHandoff} from './handoff.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
async function safeRead(path,maxBytes) {
  const st=await lstat(path);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>maxBytes)
    throw Error('Unsafe evidence file');
  return readFile(path);
}
const safeJson=async(path,maxBytes=2*1024*1024)=>
  JSON.parse((await safeRead(path,maxBytes)).toString('utf8'));
function external() {
  const witnessPins=JSON.parse(process.env.MDD_EXTERNAL_WITNESS_PINS_JSON||'null');
  const witnessNonces=JSON.parse(process.env.MDD_PREVIOUS_WITNESS_NONCES_JSON||'null');
  const handoffNonces=JSON.parse(process.env.MDD_PREVIOUS_HANDOFF_NONCES_JSON||'null');
  const seq=process.env.MDD_TRUSTED_LEDGER_SEQUENCE,
    revision=process.env.MDD_MIN_TRUSTED_CUSTODY_REVISION;
  const digest=process.env.MDD_TRUSTED_LEDGER_DIGEST,
    root=process.env.MDD_CUSTODY_ROOT_SHA256;
  if(!Array.isArray(witnessPins)||witnessPins.length!==2||!Array.isArray(witnessNonces)||
     !Array.isArray(handoffNonces)||!HASH.test(digest??'')||!HASH.test(root??'')||
     !/^(0|[1-9]\d{0,14})$/.test(seq??'')||
     !/^[1-9]\d{0,14}$/.test(revision??''))throw Error('Missing external trust inputs');
  return {witnessPins,witnessNonces,handoffNonces,sequence:Number(seq),
    revision:Number(revision),digest,root};
}
async function main(){
  const [mode,metadataPath,archivePath,sha,now]=process.argv.slice(2);
  if(mode!=='inspect'||!metadataPath||!archivePath||!SHA.test(sha??'')||
    !now||process.argv.length!==7)throw Error('Invalid arguments');
  const trust=external(),meta=await safeJson(metadataPath);
  if(!meta||typeof meta!=='object'||Array.isArray(meta)||
    Object.keys(meta).some(k=>!['handoff','closureInput','candidateInput','githubEvidence'].includes(k)))
    throw Error('Unexpected/private evidence fields');
  const closureInput=meta.closureInput;
  if(!closureInput || typeof closureInput!=='object')throw Error('Missing custody');
  if(closureInput.anchor?.custodyRootSha256!==trust.root ||
     closureInput.anchor?.ledgerDigest!==trust.digest ||
     closureInput.anchor?.ledgerSequence!==trust.sequence)
    throw Error('Trusted external custody checkpoint differs from candidate');
  const archive=await safeRead(archivePath,256*1024*1024);
  const result=inspectIndependentHandoff({
    expectedSha:sha,handoff:meta.handoff,
    closureInput:{...closureInput,
      externalWitnessPins:trust.witnessPins,
      previouslyAcceptedNonceIds:trust.witnessNonces,
      minimumAcceptedSequence:trust.sequence,
      minimumAcceptedRevision:trust.revision,
      currentTime:now,
    },
    candidateInput:{...meta.candidateInput,releaseArchive:archive},
    githubEvidence:meta.githubEvidence??null,
    previouslyUsedHandoffNonces:trust.handoffNonces,
  });
  console.log(JSON.stringify(result,null,2));
  // Successful evidence integrity is never a release authorization.
  process.exitCode=3;
}
try{await main();}
catch{
  // Never print private input, raw reviewer metadata, paths, hashes or URLs.
  console.error('P18: independent evidence handoff blocked. Release and publication remain denied.');
  process.exitCode=4;
}
