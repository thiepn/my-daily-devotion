import { lstat, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { inspectCandidate } from './candidate.mjs';

const SHA = /^[0-9a-f]{40}$/;
async function fileBytes(folder, filename, maxSize) {
  if (typeof filename !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(filename)) throw Error('Invalid filename');
  const file = join(folder, filename);
  const st = await lstat(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > maxSize || st.size <= 0) throw Error('Unsafe evidence file');
  return readFile(file);
}
async function json(folder, name) {
  const bytes = await fileBytes(folder, name, 16*1024*1024);
  return JSON.parse(bytes.toString('utf8'));
}
async function optionalJson(folder, name) {
  try { return await json(folder, name); }
  catch(e) { if(e && e.code === 'ENOENT') return null; throw e; }
}
async function main() {
  const [folderPath, sha] = process.argv.slice(2);
  if (!folderPath || !SHA.test(sha ?? '') || process.argv.length !== 4) throw Error('Invalid args');
  const folder = resolve(folderPath);
  const releaseManifest = await json(folder, 'release-manifest.json');
  const artifactName = releaseManifest.artifact;
  if (typeof artifactName !== 'string' ||
    !/^my-daily-devotion-\d+\.\d+\.\d+-web\.zip$/.test(artifactName)) throw Error('Unexpected artifact filename');
  const [deploymentHashes, verificationSummary, buildEvidence, releaseArchive, sums, p11Handoff] =
    await Promise.all([
      json(folder, 'deployment-hashes.json'),
      json(folder, 'verification-summary.json'),
      json(folder, 'build-evidence.json'),
      fileBytes(folder, artifactName, 256*1024*1024),
      fileBytes(folder, 'SHA256SUMS', 512),
      optionalJson(folder, 'p11-handoff.json'),
    ]);
  const expectedSum = releaseManifest.sha256 + '  ' + artifactName + '\n';
  if (sums.toString('utf8') !== expectedSum) throw Error('SHA256SUMS differs from release manifest');
  const result = inspectCandidate({ expectedSha: sha, releaseManifest, deploymentHashes,
    verificationSummary, buildEvidence, releaseArchive, p11Handoff });
  console.log(JSON.stringify(result, null, 2));
  // This is a local checksum inspector, NOT a deploy/release approval.
  process.exitCode = 3;
}
try { await main(); }
catch {
  // Do not disclose filesystem paths, rejected JSON, evidence URLs, notes or tokens.
  console.error('P12: invalid or incomplete candidate evidence; release remains blocked.');
  process.exitCode = 4;
}
