import test from 'node:test';
import assert from 'node:assert/strict';
import { P10_GATES, createPendingLedger, verifyExistingOrigin, assessAcceptance } from './acceptance.mjs';

const sha = 'a'.repeat(40), wrongSha = 'b'.repeat(40);
const old = 'https://devotion.example.test/devotion/';
const fixture = () => createPendingLedger(sha, old, old);
const evidence = 'https://github.com/example/repo/actions/runs/123';
const approve = (gate) => ({ ...gate, status: 'passed', evidenceUrls: [evidence],
  reviewer: 'independent-reviewer', reviewedAt: '2026-10-09T20:00:00Z' });

test('pending template enumerates mandatory gates, without release authorization', () => {
  const result = assessAcceptance(fixture(), sha);
  assert.equal(result.totalGates, P10_GATES.length);
  assert.equal(result.pending.length, P10_GATES.length);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.independentlyVerified, false);
});
test('rejects stale ledger commit', () =>
  assert.throws(() => assessAcceptance(fixture(), wrongSha), /another source commit/));
test('rejects stale gate entry even when ledger header matches', () => {
  const f = fixture(); f.gates[0].sourceCommit = wrongSha;
  assert.throws(() => assessAcceptance(f, sha), /stale/);
});
test('rejects missing, duplicated or unexpected gates', () => {
  const a = fixture(); a.gates.pop();
  assert.throws(() => assessAcceptance(a, sha), /missing or extra/);
  const b = fixture(); b.gates[1] = structuredClone(b.gates[0]);
  assert.throws(() => assessAcceptance(b, sha), /Duplicated/);
  const c = fixture(); c.gates[0].id = 'unregistered';
  assert.throws(() => assessAcceptance(c, sha), /Unknown/);
});
test('rejects claimed pass without evidence or human review', () => {
  const a = fixture(); a.gates[0].status = 'passed';
  assert.throws(() => assessAcceptance(a, sha), /without evidence/);
  const b = fixture(); b.gates[1].status = 'passed'; b.gates[1].evidenceUrls = [evidence];
  assert.throws(() => assessAcceptance(b, sha), /Missing review identity/);
});
test('even all claimed pass results cannot authorize release', () => {
  const a = fixture(); a.gates = a.gates.map(approve);
  const r = assessAcceptance(a, sha);
  assert.equal(r.evidenceComplete, true);
  assert.equal(r.independentlyVerified, false);
  assert.equal(r.releaseAuthorized, false);
  assert.ok(!JSON.stringify(r).includes('independent-reviewer'));
  assert.ok(!JSON.stringify(r).includes(evidence));
});
test('failed checks remain visible', () => {
  const a = fixture(); a.gates = a.gates.map(approve); a.gates[4].status = 'failed';
  const r = assessAcceptance(a, sha);
  assert.equal(r.evidenceComplete, false); assert.deepEqual(r.failed, [a.gates[4].id]);
});
test('rejects extra fields containing private journal or backup data', () => {
  const a = fixture(); a.privateJournal = 'never';
  assert.throws(() => assessAcceptance(a, sha), /Unexpected field/);
  const b = fixture(); b.gates[0].journalText = 'secret';
  assert.throws(() => assessAcceptance(b, sha), /Unexpected field/);
});
test('requires HTTPS, identical original origin/path, and no token-bearing query', () => {
  assert.deepEqual(verifyExistingOrigin(old, old), { originMatch: true, pathMatch: true });
  assert.throws(() => verifyExistingOrigin(old, 'https://other.example.test/devotion/'), /across origins/);
  assert.throws(() => verifyExistingOrigin(old, 'https://devotion.example.test/'), /app path/);
  assert.throws(() => verifyExistingOrigin('http://devotion.example.test/devotion/', old), /HTTPS/);
  assert.throws(() => verifyExistingOrigin(old, 'https://devotion.example.test/devotion/?token=key'), /query strings/);
});
test('rejects unsafe evidence URL protocols, credentials, duplicates', () => {
  const a = fixture(); a.gates[0].evidenceUrls = ['https://user:pass@example.test/x'];
  assert.throws(() => assessAcceptance(a, sha), /credentials/);
  const b = fixture(); b.gates[0].evidenceUrls = ['file:///etc/passwd'];
  assert.throws(() => assessAcceptance(b, sha), /HTTPS/);
  const c = fixture(); c.gates[0].evidenceUrls = [evidence, evidence];
  assert.throws(() => assessAcceptance(c, sha), /Duplicate evidence/);
});
test('rejects nonexact source SHA', () => {
  assert.throws(() => createPendingLedger('123', old, old), /40-hex/);
  assert.throws(() => assessAcceptance(fixture(), '123'), /40-hex/);
});


test('CLI never returns zero for pending or self-reported complete gates', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const folder = mkdtempSync(join(tmpdir(), 'mdd-p10-ledger-'));
  const filename = join(folder, 'evidence.json');
  try {
    const run = () => spawnSync(process.execPath, [new URL('./acceptance-cli.mjs', import.meta.url).pathname, 'assess', filename, sha], { encoding: 'utf8' });
    writeFileSync(filename, JSON.stringify(fixture()));
    const pending = run();
    assert.equal(pending.status, 2, pending.stderr);
    assert.equal(JSON.parse(pending.stdout).releaseAuthorized, false);
    const claimed = fixture(); claimed.gates = claimed.gates.map(approve);
    writeFileSync(filename, JSON.stringify(claimed));
    const complete = run();
    assert.equal(complete.status, 3, complete.stderr);
    const report = JSON.parse(complete.stdout);
    assert.equal(report.evidenceComplete, true);
    assert.equal(report.independentlyVerified, false);
    assert.equal(report.releaseAuthorized, false);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
