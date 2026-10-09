import assert from 'node:assert/strict';

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPOSITORY = 'thiepn/my-daily-devotion';
const REQUIRED_JOBS = Object.freeze([
  'Unit, contracts and one production build',
  'Reviewed journal image comparisons',
  'Browser chromium-1', 'Browser chromium-2', 'Browser chromium-3',
  'Browser mobile-1', 'Browser mobile-2', 'Browser firefox',
  'Browser webkit', 'Browser offline',
  'Certify exact artifact and complete evidence',
]);
const validId = n => Number.isSafeInteger(n) && n > 0;

/** Only GitHub responses fetched from fixed HTTPS API paths are suitable inputs. */
export function examineGithubRun({run, jobs, artifacts, sourceCommit}) {
  assert.match(sourceCommit, SHA, 'Exact source commit required');
  assert.ok(run && typeof run === 'object' && !Array.isArray(run));
  assert.ok(validId(run.id), 'Missing GitHub run ID');
  assert.equal(run.head_sha, sourceCommit, 'Source commit mismatch');
  assert.equal(run.head_branch, 'main', 'PR artifacts cannot qualify production main');
  assert.ok(['push', 'workflow_dispatch'].includes(run.event), 'Disallowed CI trigger');
  assert.equal(run.name, 'Release Certification CI');
  assert.equal(run.path, '.github/workflows/ci.yml');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success', 'Incomplete/failed run');
  assert.ok(Array.isArray(jobs) && Array.isArray(artifacts));
  assert.equal(jobs.length, REQUIRED_JOBS.length, 'Missing or unexpected mandatory CI jobs');
  const names = new Set();
  for (const job of jobs) {
    assert.ok(!names.has(job.name), 'Duplicate CI job name');
    names.add(job.name);
    assert.ok(validId(job.id), 'Missing job ID');
    assert.equal(job.run_id, run.id, 'Job belongs to another run');
    assert.equal(job.status, 'completed');
    assert.equal(job.conclusion, 'success', 'One or more mandatory jobs failed or skipped');
  }
  assert.deepEqual([...names].sort(), [...REQUIRED_JOBS].sort(), 'Wrong mandatory CI job inventory');
  const certified = artifacts.filter(a => a.name === 'mdd-certified-release');
  assert.equal(certified.length, 1, 'Missing or duplicated certified release artifact');
  const archive = certified[0];
  assert.ok(validId(archive.id) && validId(archive.workflow_run?.id), 'Invalid artifact identity');
  assert.equal(archive.workflow_run.id, run.id, 'Certified archive belongs to another run');
  assert.equal(archive.expired, false, 'Certified artifact expired');
  assert.ok(validId(archive.size_in_bytes), 'Empty certified artifact');
  if (archive.digest !== null && archive.digest !== undefined) {
    assert.match(archive.digest, DIGEST, 'Unsupported GitHub artifact transport digest');
  }
  return {
    sourceCommit, runId: run.id, artifactId: archive.id,
    artifactTransportDigest: archive.digest ?? null,
    artifactTransportDigestAvailable: Boolean(archive.digest),
    mandatoryJobsMatched: REQUIRED_JOBS.length,
    githubMetadataCrossChecked: true,
    certifiedReleaseZipBytesCompared: false,
    independentlyApprovedHumanGates: false,
    releaseAuthorized: false, deploymentPerformed: false,
  };
}

/** Read-only, fixed-route GitHub API intake; no arbitrary URLs or mutation actions. */
export async function readGithubProvenance({runId, sourceCommit, fetcher = fetch, token} = {}) {
  assert.ok(validId(runId), 'Invalid CI run ID');
  assert.match(sourceCommit, SHA);
  const origin = 'https://api.github.com/repos/' + REPOSITORY;
  const headers = {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
  if (token !== undefined) {
    assert.ok(typeof token === 'string' && token.length > 0, 'Invalid token');
    headers.Authorization = 'Bearer ' + token;
  }
  const get = async suffix => {
    const res = await fetcher(origin + suffix, {method:'GET',redirect:'error',headers});
    if (!res.ok) throw new Error('GitHub read-only provenance API request failed');
    return res.json();
  };
  const [run, jobsPage, artifactsPage] = await Promise.all([
    get('/actions/runs/' + runId),
    get('/actions/runs/' + runId + '/jobs?per_page=100&filter=latest'),
    get('/actions/runs/' + runId + '/artifacts?per_page=100'),
  ]);
  assert.ok(Array.isArray(jobsPage.jobs) && jobsPage.total_count === jobsPage.jobs.length,
    'Paginated or truncated job evidence');
  assert.ok(Array.isArray(artifactsPage.artifacts) && artifactsPage.total_count === artifactsPage.artifacts.length,
    'Paginated or truncated artifact evidence');
  const inspected = examineGithubRun({run,jobs:jobsPage.jobs,artifacts:artifactsPage.artifacts,sourceCommit});
  assert.equal(run.id, runId, 'Requested run ID differs from response');
  return inspected;
}
