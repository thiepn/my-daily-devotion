import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const SHA = /^[0-9a-f]{40}$/;
const ID = n => Number.isSafeInteger(n) && n > 0;
const HANDLES = /^[a-zA-Z0-9_.-]{1,80}$/;
const API = 'https://api.github.com/repos/thiepn/my-daily-devotion';

function timestamp(value) {
  assert.ok(typeof value === 'string' && Number.isFinite(Date.parse(value)) &&
    /(?:Z|[+-]\d\d:\d\d)$/.test(value), 'Invalid external review timestamp');
}
function uniqueId(collection, value) {
  assert.ok(!collection.has(value), 'Duplicate GitHub review identity');
  collection.add(value);
}
const sha256 = input => createHash('sha256').update(input, 'utf8').digest('hex');

/** This proves only that GitHub's current REST response reports the review;
    it does not interpret a review as app-specific visual or physical-device signoff. */
export function inspectReviewSnapshot({ pull, reviews, commits, expectedSha, expectedPr }) {
  assert.match(expectedSha, SHA);
  assert.ok(ID(expectedPr) && pull?.number === expectedPr);
  assert.equal(pull.head?.sha, expectedSha, 'PR head changed after evidence creation');
  assert.ok(Array.isArray(reviews) && reviews.length < 100, 'Review pagination not fully verified');
  assert.ok(Array.isArray(commits) && commits.length < 100, 'Commit pagination not fully verified');
  const authors = new Set([pull.user?.login]);
  for (const commit of commits) {
    if (commit.author?.login) authors.add(commit.author.login);
    if (commit.committer?.login) authors.add(commit.committer.login);
  }
  const used = new Set();
  const entries = reviews.map(review => {
    assert.ok(ID(review.id) && typeof review.user?.login === 'string' &&
      HANDLES.test(review.user.login), 'Bad review metadata');
    uniqueId(used, review.id);
    assert.match(review.commit_id, SHA);
    assert.ok(['APPROVED','CHANGES_REQUESTED','COMMENTED','DISMISSED'].includes(review.state),
      'Unrecognized GitHub review state');
    timestamp(review.submitted_at);
    assert.equal(typeof review.body, 'string', 'Missing review message');
    assert.ok(review.body.length <= 20000, 'Oversized review text');
    return {
      reviewId: review.id,
      reviewerHandle: review.user.login,
      commitSha: review.commit_id,
      state: review.state,
      submittedAt: review.submitted_at,
      bodySha256: sha256(review.body),
      onExpectedHead: review.commit_id === expectedSha,
      independentOfKnownCodeAuthors: !authors.has(review.user.login),
    };
  });
  return {
    sourceCommit: expectedSha, pullNumber: expectedPr,
    entries, githubResponseStructurallyChecked: true,
    visualApprovalVerified: false,
    deviceAcceptanceVerified: false,
    operatorDecisionVerified: false,
    releaseAuthorized: false,
  };
}

/** Fixed-route, read-only intake. Reject truncated responses, redirects and pagination. */
export async function readGithubReviewSnapshot({
  prNumber, expectedSha, fetcher = fetch, token,
} = {}) {
  assert.ok(ID(prNumber) && prNumber <= 1000000);
  assert.match(expectedSha, SHA);
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
  };
  if (token !== undefined) {
    assert.ok(typeof token === 'string' && token.length > 0);
    headers.Authorization = 'Bearer ' + token;
  }
  const get = async suffix => {
    const res = await fetcher(API + suffix, {method:'GET',redirect:'error',headers});
    if (!res?.ok) throw new Error('GitHub review metadata request failed');
    if (res.headers?.get?.('link')?.includes('rel="next"')) {
      throw new Error('Review/commit pages truncated');
    }
    return res.json();
  };
  const base = '/pulls/' + prNumber;
  const [pull, reviews, commits] = await Promise.all([
    get(base), get(base + '/reviews?per_page=100'), get(base + '/commits?per_page=100'),
  ]);
  return inspectReviewSnapshot({pull,reviews,commits,expectedSha,expectedPr:prNumber});
}
