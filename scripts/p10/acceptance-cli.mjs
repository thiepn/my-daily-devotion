import { readFile, writeFile } from 'node:fs/promises';
import { createPendingLedger, assessAcceptance } from './acceptance.mjs';

const [operation, ...args] = process.argv.slice(2);
if (operation === 'template' && args.length === 4) {
  const [sha, existingOrigin, candidateOrigin, output] = args;
  const ledger = createPendingLedger(sha, existingOrigin, candidateOrigin);
  await writeFile(output, JSON.stringify(ledger, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Wrote pending-only acceptance template; no evidence has been approved.');
} else if (operation === 'assess' && args.length === 2) {
  const [path, sha] = args;
  const result = assessAcceptance(JSON.parse(await readFile(path, 'utf8')), sha);
  console.log(JSON.stringify(result, null, 2));
  if (!result.evidenceComplete) process.exitCode = 2;
  // Even a complete ledger is not independently verified and must never authorize release.
} else {
  console.error('Usage: node scripts/p10/acceptance-cli.mjs template SHA EXISTING_HTTPS_URL CANDIDATE_HTTPS_URL FILE | assess FILE SHA');
  process.exitCode = 2;
}
