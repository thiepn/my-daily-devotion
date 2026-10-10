import {lstat,readFile} from 'node:fs/promises';
import {inspectP20Escalation} from './escalation.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/;
const UNSIGNED_INT=/^(0|[1-9]\d{0,14})$/;
async function safe(path,max) {
  const st=await lstat(path);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)throw Error('Unsafe file');
  return readFile(path);
}
function parseList(name,max=10000) {
  const v=JSON.parse(process.env[name]??'null');
  if(!Array.isArray(v)||v.length>max)throw Error('Missing independently sourced list');
  return v;
}
function requireFields(value,allowed) {
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Unexpected/private metadata');
}
function external() {
  const root=process.env.MDD_CUSTODY_ROOT_SHA256,
    ledger=process.env.MDD_TRUSTED_LEDGER_DIGEST,
    opDigest=process.env.MDD_OPERATOR_LEDGER_DIGEST,
    rotDigest=process.env.MDD_P20_ROTATION_LEDGER_DIGEST;
  const seq=process.env.MDD_TRUSTED_LEDGER_SEQUENCE,
    rev=process.env.MDD_MIN_TRUSTED_CUSTODY_REVISION,
    opSeq=process.env.MDD_OPERATOR_LEDGER_SEQUENCE,
    rotSeq=process.env.MDD_P20_ROTATION_LEDGER_SEQUENCE,
    active=process.env.MDD_P20_PREVIOUS_ACTIVE_KEY_ID;
  if(![root,ledger,opDigest,rotDigest].every(x=>HASH.test(x??''))||
    ![seq,opSeq,rotSeq].every(x=>UNSIGNED_INT.test(x??''))||
    !/^[1-9]\d{0,14}$/.test(rev??'') ||
    !/^[A-Za-z0-9_.-]{2,64}$/.test(active??''))throw Error('Missing external trust checkpoint');
  const witnesses=parseList('MDD_EXTERNAL_WITNESS_PINS_JSON',2),
    operators=parseList('MDD_EXTERNAL_OPERATOR_PINS_JSON',2),
    rotationPins=parseList('MDD_P20_EXTERNAL_ROTATION_PINS_JSON',3);
  if(witnesses.length!==2||operators.length!==2||rotationPins.length!==3)
    throw Error('Incorrect external key inventory');
  return {root,ledger,opDigest,rotDigest,seq:Number(seq),rev:Number(rev),
    opSeq:Number(opSeq),rotSeq:Number(rotSeq),active,witnesses,operators,rotationPins,
    witnessNonces:parseList('MDD_PREVIOUS_WITNESS_NONCES_JSON'),
    handoffNonces:parseList('MDD_PREVIOUS_HANDOFF_NONCES_JSON'),
    operatorNonces:parseList('MDD_PREVIOUS_OPERATOR_NONCES_JSON'),
    rotationNonces:parseList('MDD_P20_PREVIOUS_ROTATION_NONCES_JSON'),
    escalationNonces:parseList('MDD_P20_PREVIOUS_ESCALATION_NONCES_JSON'),
    revokedKeys:parseList('MDD_P20_PREVIOUS_REVOKED_KEYS_JSON'),
  };
}
async function main(){
  const [mode,packetPath,releaseZipPath,sourceCommit,currentTime]=process.argv.slice(2);
  if(mode!=='hold'||!packetPath||!releaseZipPath||!SHA.test(sourceCommit??'')||
    !currentTime||process.argv.length!==7)throw Error('Invalid command');
  const trust=external();
  const data=JSON.parse((await safe(packetPath,2*1024*1024)).toString('utf8'));
  requireFields(data,['p19Input','rotation','ticket','evidencePackets']);
  const p19=data.p19Input;
  requireFields(p19,['p18Input','operatorRecord']);
  requireFields(p19.p18Input,['handoff','closureInput','candidateInput','githubEvidence']);
  const evidence=p19.p18Input,closure=evidence.closureInput;
  requireFields(evidence.candidateInput,['expectedSha','releaseManifest','deploymentHashes',
    'verificationSummary','buildEvidence']);
  requireFields(closure,['sourceCommit','originalSiteUrl','anchor','rootPublicSpkiDerBase64',
    'manifest','records','checkpoint','previouslyUsedNonces','codeAuthorHandles',
    'deviceClaims','devicePackets','migrationPacket','recoveryPlan','archiveEvidence','gateClaims']);
  if(closure.anchor?.custodyRootSha256!==trust.root||
    closure.anchor?.ledgerDigest!==trust.ledger||
    closure.anchor?.ledgerSequence!==trust.seq)throw Error('Untrusted custody checkpoint');
  const releaseArchive=await safe(releaseZipPath,256*1024*1024);
  const verified=inspectP20Escalation({
    sourceCommit,currentTime,previouslyUsedEscalationNonces:trust.escalationNonces,
    p19Input:{...p19,expectedSha:sourceCommit,
      p18Input:{...evidence,
        candidateInput:{...evidence.candidateInput,releaseArchive},
        closureInput:{...closure,externalWitnessPins:trust.witnesses,
          previouslyAcceptedNonceIds:trust.witnessNonces,
          minimumAcceptedSequence:trust.seq,
          minimumAcceptedRevision:trust.rev,currentTime},
        previouslyUsedHandoffNonces:trust.handoffNonces,
      },
      externalOperatorPins:trust.operators,
      externallyTrustedPriorSequence:trust.opSeq,
      externallyTrustedPriorDigest:trust.opDigest,
      previouslyUsedDecisionNonces:trust.operatorNonces,currentTime,
    },
    rotationInput:{rotation:data.rotation,externalPins:trust.rotationPins,
      previousSequence:trust.rotSeq,previousDigest:trust.rotDigest,
      previousActiveKeyId:trust.active,previouslyRevokedKeyIds:trust.revokedKeys,
      previouslyUsedRotationNonces:trust.rotationNonces},
    evidencePackets:data.evidencePackets,ticket:data.ticket,
  });
  console.log(JSON.stringify(verified,null,2));
  process.exitCode=3; // Verified form/signatures never mean approved real world actions.
}
try{await main();}
catch{
  console.error('P20: external custody or release evidence is insufficient. HOLD; no release action.');
  process.exitCode=4;
}
