import assert from 'node:assert/strict';
import { assessAcceptance, verifyExistingOrigin, P10_GATES } from '../p10/acceptance.mjs';
const SHA=/^[0-9a-f]{40}$/, DIGEST=/^[0-9a-f]{64}$/;
const GATES=new Set(P10_GATES.map(([id])=>id));
function exact(o, fields) {
  assert.ok(o && typeof o==='object' && !Array.isArray(o), 'Expected metadata object');
  assert.deepEqual(Object.keys(o).filter(k=>!fields.includes(k)), [], 'Unexpected field: private data forbidden');
}
function safeURL(v) {
  assert.equal(typeof v,'string','Expected HTTPS URL');
  const u=new URL(v);
  assert.equal(u.protocol,'https:','HTTPS required');
  assert.ok(u.hostname && !u.username && !u.password && !u.search && !u.hash,
    'No credentials, tokens or URL fragments');
  return u;
}
function sameSite(candidate, original) {
  const c=safeURL(candidate),o=safeURL(original);
  assert.equal(c.origin,o.origin,'Original browser origin must remain unchanged');
  assert.equal(c.pathname,o.pathname,'Original application path must remain unchanged');
}
function positive(n) { assert.ok(Number.isSafeInteger(n) && n>0,'Positive integer expected'); }
function assetPath(path) {
  assert.ok(typeof path==='string' && path.length>0 && path.length<251 &&
    !path.startsWith('/') && !/[\\%?:#]/.test(path) && !path.includes('//') &&
    path.split('/').every(s=>s && s!=='.' && s!=='..'), 'Noncanonical asset path');
}
function manifestCheck(m, sha) {
  if(m===null)return false;
  exact(m,['sourceCommit','version','artifact','sha256','databaseSchemaVersion','fileCount','files']);
  assert.equal(m.sourceCommit,sha,'Manifest source commit mismatch');
  assert.match(m.version,/^\d+\.\d+\.\d+$/);
  assert.equal(m.artifact,'my-daily-devotion-'+m.version+'-web.zip');
  assert.match(m.sha256,DIGEST);
  positive(m.databaseSchemaVersion);
  assert.ok(m.databaseSchemaVersion>=3,'Schema 3 must not downgrade');
  positive(m.fileCount);
  assert.ok(m.files && typeof m.files==='object' && !Array.isArray(m.files));
  assert.equal(Object.keys(m.files).length,m.fileCount,'Incomplete file checksums');
  assert.ok(Object.hasOwn(m.files,'build-info.json') && Object.hasOwn(m.files,'index.html'),
    'Missing site entrypoint or build identity');
  for(const [path,hash] of Object.entries(m.files)){assetPath(path);assert.match(hash,DIGEST);}
  return true;
}
function certificationCheck(c, sha, manifest) {
  if(c===null)return false;
  exact(c,['runId','sourceCommit','workflow','branch','event','status','conclusion','archiveSha256','artifactId']);
  positive(c.runId);positive(c.artifactId);
  assert.equal(c.sourceCommit,sha,'Certification source SHA mismatch');
  assert.equal(c.workflow,'Release Certification CI');
  assert.equal(c.branch,'main','PR merge artifacts are not deployable');
  assert.ok(['push','workflow_dispatch'].includes(c.event),'PR event cannot certify main deployment');
  assert.equal(c.status,'completed');assert.equal(c.conclusion,'success');
  assert.match(c.archiveSha256,DIGEST);
  assert.ok(manifest,'Cannot certify absent archive manifest');
  assert.equal(c.archiveSha256,manifest.sha256,'Archive digest differs from certificate claim');
  return true;
}
function reviewerCheck(claims, sha) {
  assert.ok(Array.isArray(claims) && claims.length<=P10_GATES.length);
  const seen=new Set();
  for(const c of claims){
    exact(c,['gateId','sourceCommit','reviewerHandle','reviewedAt','evidenceUrl','decision']);
    assert.ok(GATES.has(c.gateId),'Unknown gate');assert.ok(!seen.has(c.gateId),'Duplicate reviewer claim');
    seen.add(c.gateId);assert.equal(c.sourceCommit,sha,'Stale unsigned review');
    assert.ok(typeof c.reviewerHandle==='string' && /^[a-zA-Z0-9_.-]{2,80}$/.test(c.reviewerHandle),
      'Use only non-sensitive reviewer handles');
    assert.ok(typeof c.reviewedAt==='string' && !Number.isNaN(Date.parse(c.reviewedAt)) &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(c.reviewedAt),'Missing timestamp');
    assert.ok(c.decision==='accept'||c.decision==='reject','Review decision missing');
    safeURL(c.evidenceUrl);
  }
  return claims.length;
}
export function makePendingHandoff(sha, originalSiteUrl) {
  assert.match(sha,SHA,'Exact 40-character SHA required');
  sameSite(originalSiteUrl,originalSiteUrl);
  return {schemaVersion:1,sourceCommit:sha,originalSiteUrl,candidateSiteUrl:originalSiteUrl,
    acceptance:{schemaVersion:1,sourceCommit:sha,existingSiteUrl:originalSiteUrl,candidateSiteUrl:originalSiteUrl,
      gates:P10_GATES.map(([id])=>({id,status:'pending',sourceCommit:sha,evidenceUrls:[]}))},
    manifest:null,certification:null,reviewerClaims:[],postReleaseObservation:null};
}
export function assessPostRelease(h,observation) {
  if(observation===null)return {observationsMatch:false,independentlyVerified:false};
  exact(observation,['sourceCommit','siteUrl','buildInfo','assets','serviceWorkerScriptUrl',
    'serviceWorkerScopeUrl','databaseSchemaVersion']);
  assert.equal(observation.sourceCommit,h.sourceCommit,'Deployed SHA mismatch');
  sameSite(observation.siteUrl,h.originalSiteUrl);
  assert.ok(h.manifest,'Cannot assess absent release manifest');
  exact(observation.buildInfo,['sourceCommit','version']);
  assert.equal(observation.buildInfo.sourceCommit,h.sourceCommit,'Build-info SHA mismatch');
  assert.equal(observation.buildInfo.version,h.manifest.version,'Build-info version mismatch');
  assert.equal(observation.databaseSchemaVersion,h.manifest.databaseSchemaVersion,'Schema mismatch');
  const base=safeURL(h.originalSiteUrl);
  assert.equal(safeURL(observation.serviceWorkerScopeUrl).href,base.href,'Service worker scope mismatch');
  assert.equal(safeURL(observation.serviceWorkerScriptUrl).href,new URL('sw.js',base).href,
    'Service worker script outside original scope');
  assert.ok(observation.assets && typeof observation.assets==='object' &&
    !Array.isArray(observation.assets),'Asset observations required');
  assert.equal(Object.keys(observation.assets).length,h.manifest.fileCount,'Missing/extra assets');
  for(const [path,sha256] of Object.entries(observation.assets)){
    assetPath(path);assert.ok(Object.hasOwn(h.manifest.files,path),'Unexpected asset');
    assert.equal(sha256,h.manifest.files[path],'Asset hash mismatch');
  }
  return {observationsMatch:true,independentlyVerified:false};
}
export function assessHandoff(h,expectedSha) {
  assert.match(expectedSha,SHA,'Exact 40-character SHA required');
  exact(h,['schemaVersion','sourceCommit','originalSiteUrl','candidateSiteUrl',
    'acceptance','manifest','certification','reviewerClaims','postReleaseObservation']);
  assert.equal(h.schemaVersion,1);assert.equal(h.sourceCommit,expectedSha,'Stale handoff source');
  verifyExistingOrigin(h.originalSiteUrl,h.candidateSiteUrl);
  const accepted=assessAcceptance(h.acceptance,expectedSha);
  sameSite(h.acceptance.existingSiteUrl,h.originalSiteUrl);
  sameSite(h.acceptance.candidateSiteUrl,h.originalSiteUrl);
  const manifest=manifestCheck(h.manifest,expectedSha);
  const certified=certificationCheck(h.certification,expectedSha,h.manifest);
  const claimCount=reviewerCheck(h.reviewerClaims,expectedSha);
  const observed=assessPostRelease(h,h.postReleaseObservation);
  const missing=[];
  if(!manifest)missing.push('release-manifest');
  if(!certified)missing.push('exact-main-certification');
  if(!accepted.evidenceComplete)missing.push('p10-acceptance');
  if(!observed.observationsMatch)missing.push('post-release-observation');
  return {schemaVersion:1,sourceCommit:expectedSha,claimedManifest:manifest,
    claimedCertification:certified,unsignedReviewerClaims:claimCount,
    claimedAcceptanceComplete:accepted.evidenceComplete,
    claimedObservedAssetsMatch:observed.observationsMatch,missing,
    independentlyVerified:false,releaseAuthorized:false,deploymentPerformed:false,
    message:'Unsigned metadata does not authorize merge, release publication, deployment, cache purge or rollback.'};
}
