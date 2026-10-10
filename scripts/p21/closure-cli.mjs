import {lstat,readFile} from 'node:fs/promises';
import {inspectP21OwnerClosure} from './owner-closure.mjs';

const SHA=/^[0-9a-f]{40}$/,HASH=/^[0-9a-f]{64}$/,NUM=/^(0|[1-9]\d{0,14})$/;
async function file(path,max){
  const stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)throw Error('Unsafe file');
  return readFile(path);
}
function list(name,max=10000){
 const value=JSON.parse(process.env[name]??'null');
 if(!Array.isArray(value)||value.length>max)throw Error('Missing separate operator registry');
 return value;
}
function safe(o,fields){
 if(!o||typeof o!=='object'||Array.isArray(o)||
    Object.keys(o).some(x=>!fields.includes(x)))throw Error('Private/unknown fields');
}
function external(){
 const values=['MDD_CUSTODY_ROOT_SHA256','MDD_TRUSTED_LEDGER_DIGEST',
  'MDD_OPERATOR_LEDGER_DIGEST','MDD_P20_ROTATION_LEDGER_DIGEST',
  'MDD_P21_OWNER_LEDGER_DIGEST'].map(x=>process.env[x]);
 if(!values.every(x=>HASH.test(x??'')))throw Error('Untrusted source registry');
 const seq=['MDD_TRUSTED_LEDGER_SEQUENCE','MDD_OPERATOR_LEDGER_SEQUENCE',
  'MDD_P20_ROTATION_LEDGER_SEQUENCE','MDD_P21_OWNER_LEDGER_SEQUENCE']
   .map(x=>process.env[x]);
 if(!seq.every(x=>NUM.test(x??'')))throw Error('Untrusted history revision');
 const rev=process.env.MDD_MIN_TRUSTED_CUSTODY_REVISION;
 if(!/^[1-9]\d{0,14}$/.test(rev??''))throw Error('Untrusted custody floor');
 const active=process.env.MDD_P20_PREVIOUS_ACTIVE_KEY_ID;
 if(!/^[A-Za-z0-9_.-]{2,64}$/.test(active??''))throw Error('Missing old key custody');
 const keySets=[
  list('MDD_EXTERNAL_WITNESS_PINS_JSON',2),
  list('MDD_EXTERNAL_OPERATOR_PINS_JSON',2),
  list('MDD_P20_EXTERNAL_ROTATION_PINS_JSON',3),
  list('MDD_P21_EXTERNAL_OWNER_PINS_JSON',2),
 ];
 if(keySets.some((keys,i)=>keys.length!==[2,2,3,2][i]))throw Error('Missing owner-reviewed trust roots');
 return {
  values,seq:seq.map(Number),rev:Number(rev),active,keySets,
  nonceSets:[
   list('MDD_PREVIOUS_WITNESS_NONCES_JSON'),
   list('MDD_PREVIOUS_HANDOFF_NONCES_JSON'),
   list('MDD_PREVIOUS_OPERATOR_NONCES_JSON'),
   list('MDD_P20_PREVIOUS_ROTATION_NONCES_JSON'),
   list('MDD_P20_PREVIOUS_ESCALATION_NONCES_JSON'),
   list('MDD_P21_PREVIOUS_OWNER_NONCES_JSON'),
  ],
  revoked:list('MDD_P20_PREVIOUS_REVOKED_KEYS_JSON'),
 };
}
async function main(){
 const [mode,packetPath,archivePath,sourceCommit,currentTime]=process.argv.slice(2);
 if(mode!=='review'||!packetPath||!archivePath||!SHA.test(sourceCommit??'')||
   !currentTime||process.argv.length!==7)throw Error('Invalid invocation');
 const trust=external();
 const data=JSON.parse((await file(packetPath,2*1024*1024)).toString('utf8'));
 safe(data,['p19Input','rotation','ticket','evidencePackets','hostPacket',
   'physicalPackets','recoveryPacket','ownerRecords']);
 const p19=data.p19Input;
 safe(p19,['p18Input','operatorRecord']);
 const e=p19.p18Input;safe(e,['handoff','closureInput','candidateInput','githubEvidence']);
 safe(e.candidateInput,['expectedSha','releaseManifest','deploymentHashes',
    'verificationSummary','buildEvidence']);
 const c=e.closureInput;
 safe(c,['sourceCommit','originalSiteUrl','anchor','rootPublicSpkiDerBase64',
  'manifest','records','checkpoint','previouslyUsedNonces','codeAuthorHandles',
  'deviceClaims','devicePackets','migrationPacket','recoveryPlan','archiveEvidence','gateClaims']);
 if(c.anchor?.custodyRootSha256!==trust.values[0] ||
    c.anchor?.ledgerDigest!==trust.values[1] ||
    c.anchor?.ledgerSequence!==trust.seq[0])
   throw Error('Missing independent original custody checkpoint');
 const archive=await file(archivePath,256*1024*1024);
 const p20Input={
  sourceCommit,currentTime,
  p19Input:{...p19,expectedSha:sourceCommit,currentTime,
   p18Input:{...e,
    candidateInput:{...e.candidateInput,releaseArchive:archive},
    closureInput:{...c,externalWitnessPins:trust.keySets[0],
     previouslyAcceptedNonceIds:trust.nonceSets[0],
     minimumAcceptedSequence:trust.seq[0],
     minimumAcceptedRevision:trust.rev,currentTime},
    previouslyUsedHandoffNonces:trust.nonceSets[1]},
   externalOperatorPins:trust.keySets[1],
   externallyTrustedPriorSequence:trust.seq[1],
   externallyTrustedPriorDigest:trust.values[2],
   previouslyUsedDecisionNonces:trust.nonceSets[2]},
  rotationInput:{rotation:data.rotation,externalPins:trust.keySets[2],
   previousSequence:trust.seq[2],previousDigest:trust.values[3],
   previousActiveKeyId:trust.active,previouslyRevokedKeyIds:trust.revoked,
   previouslyUsedRotationNonces:trust.nonceSets[3]},
  evidencePackets:data.evidencePackets,ticket:data.ticket,
  previouslyUsedEscalationNonces:trust.nonceSets[4],
 };
 const report=inspectP21OwnerClosure({
  sourceCommit,p21Input:{sourceCommit,p20Input,hostPacket:data.hostPacket,
   physicalPackets:data.physicalPackets??[],recoveryPacket:data.recoveryPacket??null},
  ownerRecords:data.ownerRecords,independentOwnerPins:trust.keySets[3],
  trustedPreviousSequence:trust.seq[3],trustedPreviousDigest:trust.values[4],
  previouslyUsedOwnerNonces:trust.nonceSets[5],currentTime,
 });
 console.log(JSON.stringify(report,null,2));
 process.exitCode=3; // Cryptographic evidence never means authorized release.
}
try {await main();}
catch{
 console.error('P21: independent original-host, owner and recovery evidence remain on HOLD.');
 process.exitCode=4;
}
