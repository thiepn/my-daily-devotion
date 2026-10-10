import {lstat,readFile} from 'node:fs/promises';
import {inspectP19Decision} from './decision.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const numberText=/^(0|[1-9]\d{0,14})$/;
async function safeFile(path,cap) {
  const st=await lstat(path);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>cap)
    throw Error('Unsafe source file');
  return readFile(path);
}
function list(name) {
  const value=JSON.parse(process.env[name]??'null');
  if(!Array.isArray(value)||value.length>10000)throw Error('Missing independent registry');
  return value;
}
function exact(o,keys) {
  if(!o||typeof o!=='object'||Array.isArray(o)||
     Object.keys(o).some(key=>!keys.includes(key)))throw Error('Unknown/private input');
}
function independentTrust(){
  const root=process.env.MDD_CUSTODY_ROOT_SHA256,
    previousDigest=process.env.MDD_TRUSTED_LEDGER_DIGEST,
    operatorDigest=process.env.MDD_OPERATOR_LEDGER_DIGEST;
  const sequence=process.env.MDD_TRUSTED_LEDGER_SEQUENCE,
    revision=process.env.MDD_MIN_TRUSTED_CUSTODY_REVISION,
    operatorSequence=process.env.MDD_OPERATOR_LEDGER_SEQUENCE;
  if(![root,previousDigest,operatorDigest].every(x=>HASH.test(x??'')) ||
    !numberText.test(sequence??'') ||
    !/^[1-9]\d{0,14}$/.test(revision??'') ||
    !numberText.test(operatorSequence??''))throw Error('Missing independent history');
  const witnesses=list('MDD_EXTERNAL_WITNESS_PINS_JSON');
  const operators=list('MDD_EXTERNAL_OPERATOR_PINS_JSON');
  if(witnesses.length!==2||operators.length!==2)throw Error('Missing independent witness pins');
  return {root,previousDigest,operatorDigest,
    sequence:Number(sequence),revision:Number(revision),
    operatorSequence:Number(operatorSequence),
    witnesses,operators,
    witnessNonces:list('MDD_PREVIOUS_WITNESS_NONCES_JSON'),
    handoffNonces:list('MDD_PREVIOUS_HANDOFF_NONCES_JSON'),
    operatorNonces:list('MDD_PREVIOUS_OPERATOR_NONCES_JSON')};
}
async function main(){
  const [mode,packetPath,releaseZipPath,sourceCommit,currentTime]=process.argv.slice(2);
  if(mode!=='hold'||!packetPath||!releaseZipPath||!SHA.test(sourceCommit??'')||
     !currentTime||process.argv.length!==7)throw Error('Invalid arguments');
  const trust=independentTrust();
  const pack=JSON.parse((await safeFile(packetPath,2*1024*1024)).toString('utf8'));
  exact(pack,['p18Input','operatorRecord']);
  exact(pack.p18Input,['handoff','closureInput','candidateInput','githubEvidence']);
  const evidence=pack.p18Input,closure=evidence.closureInput;
  exact(closure,['sourceCommit','originalSiteUrl','anchor','rootPublicSpkiDerBase64',
    'manifest','records','checkpoint','previouslyUsedNonces','codeAuthorHandles',
    'deviceClaims','devicePackets','migrationPacket','recoveryPlan','archiveEvidence','gateClaims']);
  exact(evidence.candidateInput,['expectedSha','releaseManifest','deploymentHashes',
    'verificationSummary','buildEvidence']);
  if(closure.anchor?.custodyRootSha256!==trust.root ||
     closure.anchor?.ledgerDigest!==trust.previousDigest ||
     closure.anchor?.ledgerSequence!==trust.sequence)
    throw Error('Independent checkpoint mismatch');
  const releaseArchive=await safeFile(releaseZipPath,256*1024*1024);
  const report=inspectP19Decision({
    expectedSha:sourceCommit,
    p18Input:{
      ...evidence,
      candidateInput:{...evidence.candidateInput,releaseArchive},
      closureInput:{...closure,externalWitnessPins:trust.witnesses,
        previouslyAcceptedNonceIds:trust.witnessNonces,
        minimumAcceptedSequence:trust.sequence,
        minimumAcceptedRevision:trust.revision,currentTime},
      previouslyUsedHandoffNonces:trust.handoffNonces,
      githubEvidence:evidence.githubEvidence??null,
    },
    operatorRecord:pack.operatorRecord,externalOperatorPins:trust.operators,
    externallyTrustedPriorSequence:trust.operatorSequence,
    externallyTrustedPriorDigest:trust.operatorDigest,
    previouslyUsedDecisionNonces:trust.operatorNonces,currentTime,
  });
  console.log(JSON.stringify(report,null,2));
  process.exitCode=3; // Successful inspection is NOT approval, merge or deploy.
}
try{await main();}
catch{
  console.error('P19: independent evidence custody check blocked; release remains denied.');
  process.exitCode=4;
}
