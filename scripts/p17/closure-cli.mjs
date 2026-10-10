import {lstat,readFile} from 'node:fs/promises';
import {inspectP17Closure} from './closure.mjs';

const SHA=/^[0-9a-f]{40}$/;
async function safeJson(file) {
  const stat=await lstat(file);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size<1 || stat.size>2*1024*1024)
    throw Error('Invalid file');
  return JSON.parse(await readFile(file,'utf8'));
}
function trustedEnvironment() {
  const pins=JSON.parse(process.env.MDD_EXTERNAL_WITNESS_PINS_JSON || 'null');
  const nonces=JSON.parse(process.env.MDD_PREVIOUS_WITNESS_NONCES_JSON || 'null');
  const sequence=process.env.MDD_MIN_WITNESSED_LEDGER_SEQUENCE;
  const revision=process.env.MDD_MIN_WITNESSED_CUSTODY_REVISION;
  if(!Array.isArray(pins) || pins.length!==2 || !Array.isArray(nonces) ||
     !/^(0|[1-9]\d{0,14})$/.test(sequence??'') ||
     !/^[1-9]\d{0,14}$/.test(revision??''))throw Error('Missing external witness custody');
  return {
    externalWitnessPins:pins,previouslyAcceptedNonceIds:nonces,
    minimumAcceptedSequence:Number(sequence),minimumAcceptedRevision:Number(revision),
  };
}
async function main() {
  const [mode,path,sha,now]=process.argv.slice(2);
  if(mode!=='inspect' || !path || !SHA.test(sha??'') ||
     !now || process.argv.length!==6)throw Error('Invalid arguments');
  // Both witness keys and the previous replay checkpoint floor must be supplied
  // out-of-band by a trusted operator, never copied from the receipt input.
  const external=trustedEnvironment(),input=await safeJson(path);
  if(!input || typeof input!=='object' || Array.isArray(input) ||
     Object.keys(input).some(k=>![
       'sourceCommit','originalSiteUrl','anchor','rootPublicSpkiDerBase64','manifest',
       'records','checkpoint','previouslyUsedNonces','codeAuthorHandles','deviceClaims',
       'devicePackets','migrationPacket','recoveryPlan','archiveEvidence','gateClaims',
     ].includes(k)))throw Error('Unexpected/private metadata');
  if(input.sourceCommit!==sha)throw Error('Source differs');
  const report=inspectP17Closure({...input,...external,currentTime:now});
  console.log(JSON.stringify(report,null,2));
  // Structural and cryptographic validity is not a human, hardware or release signoff.
  process.exitCode=3;
}
try {await main();}
catch {
  console.error('P17: evidence validation blocked; no external human acceptance or release authority established.');
  process.exitCode=4;
}
