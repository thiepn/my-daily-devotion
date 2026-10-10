import assert from 'node:assert/strict';
import {verifyExistingOrigin} from '../p10/acceptance.mjs';
import {strictObject,sha256,canonical} from '../p16/custody.mjs';
import {inspectP20Escalation} from '../p20/escalation.mjs';

const SHA=/^[0-9a-f]{40}$/, HASH=/^[0-9a-f]{64}$/;
const SOURCE_FIELDS=['sourceCommit','originalSiteUrl','pwaScopeUrl','swScriptUrl',
  'pwaManifestSha256','serviceWorkerSha256','originalHostEvidenceSha256',
  'sourceRightsEvidenceSha256','rightsReviewStatus','cdnEvidenceSha256','cdnReviewStatus'];
const DEVICE_FIELDS=['sourceCommit','kind','subjectId','reviewReceiptDigest','evidenceSha256',
  'reviewStatus','deviceClass','claimedPhysical'];
const RECOVERY_FIELDS=['sourceCommit','originalSiteUrl','previousStableCommit',
  'previousStableArchiveSha256','installedSchema','repairTargetSchema',
  'backupFormat','offDeviceEncrypted','backupEvidenceSha256',
  'restoreEvidenceSha256','recoveryEvidenceSha256','profileKind','method',
  'clearOriginStorage','purgeCaches','downgradeSchema','modifyLiveRecords','claimedOutcome'];
const SUBJECTS={
 'android-device':{'android-chrome':'android-phone','android-samsung-internet':'android-phone'},
 'accessibility':{'android-talkback':'android-phone','keyboard-and-focus':'keyboard-desktop',
   'contrast-and-text-200':'keyboard-desktop'},
 'migration-backup':{'original-origin-schema-migration':'disposable-profile',
   'encrypted-off-device-backup-restore':'disposable-profile'},
};
const PRIVACY_SAFE=['PENDING','REVIEW_REQUESTED','REJECTED'];
function validUrl(value) {
 assert.ok(typeof value==='string');
 const u=new URL(value);
 assert.equal(u.protocol,'https:','Only HTTPS source and PWA endpoints permitted');
 assert.ok(u.hostname&&!u.username&&!u.password&&!u.hash&&!u.search,
   'Original-host URL must exclude private tokens and fragments');
 return u;
}
function checkSource(sourceCommit,site,proof) {
 strictObject(proof,SOURCE_FIELDS);
 assert.equal(proof.sourceCommit,sourceCommit,'Original-host packet source SHA mismatch');
 verifyExistingOrigin(site,proof.originalSiteUrl);
 verifyExistingOrigin(site,proof.pwaScopeUrl);
 const sw=validUrl(proof.swScriptUrl),scope=validUrl(proof.pwaScopeUrl);
 assert.equal(sw.origin,scope.origin,'Cross-origin service worker forbidden');
 assert.ok(sw.pathname.startsWith(scope.pathname),
   'Service worker script outside the original app path');
 assert.ok(sw.pathname.endsWith('.js'),'Service worker evidence must be a script');
 for(const id of ['pwaManifestSha256','serviceWorkerSha256','originalHostEvidenceSha256',
   'sourceRightsEvidenceSha256','cdnEvidenceSha256']) assert.match(proof[id],HASH);
 assert.ok(PRIVACY_SAFE.includes(proof.rightsReviewStatus),
   'Unverified source rights cannot be automatically approved');
 assert.ok(PRIVACY_SAFE.includes(proof.cdnReviewStatus),
   'Unverified CDN rights cannot be automatically approved');
}
function checkDevices(sourceCommit,reviewPackets,recordRows) {
 assert.ok(Array.isArray(reviewPackets)&&reviewPackets.length<=20);
 const names=new Set(),counts={};
 for(const proof of reviewPackets) {
   strictObject(proof,DEVICE_FIELDS);
   assert.equal(proof.sourceCommit,sourceCommit,'Device evidence source mismatch');
   assert.ok(Object.hasOwn(SUBJECTS,proof.kind)&&
     Object.hasOwn(SUBJECTS[proof.kind],proof.subjectId),'Invalid physical or migration subject');
   const id=proof.kind+'/'+proof.subjectId;
   assert.ok(!names.has(id),'Duplicate independently reviewed evidence');
   names.add(id);
   assert.equal(proof.deviceClass,SUBJECTS[proof.kind][proof.subjectId],
     'Evidence cannot masquerade as another device class');
   assert.equal(proof.claimedPhysical,true,'Synthetic hardware claims cannot pass physical intake');
   assert.ok(PRIVACY_SAFE.includes(proof.reviewStatus),'Only pending/rejected review intake permitted');
   assert.match(proof.reviewReceiptDigest,HASH);
   assert.match(proof.evidenceSha256,HASH);
   const receipt=recordRows.find(row=>row.receipt?.subjectType===proof.kind &&
      row.receipt.subjectId===proof.subjectId &&
      row.receipt.sourceCommit===sourceCommit && row.receipt.decision==='accept');
   assert.ok(receipt,'Human evidence must reference signed exact-source reviewer receipt');
   assert.equal(receipt.digest,proof.reviewReceiptDigest,'Device review receipt digest mismatch');
   assert.equal(receipt.receipt.evidenceSha256,proof.evidenceSha256,
     'Signed evidence digest mismatch');
   counts[proof.kind]=(counts[proof.kind]||0)+1;
 }
 return counts;
}
function checkRecovery(sourceCommit,site,proof,reviewRows) {
 strictObject(proof,RECOVERY_FIELDS);
 assert.equal(proof.sourceCommit,sourceCommit,'Forward recovery source mismatch');
 verifyExistingOrigin(site,proof.originalSiteUrl);
 assert.match(proof.previousStableCommit,SHA,'Previous stable exact source SHA required');
 assert.notEqual(proof.previousStableCommit,sourceCommit,
   'Previous stable release must be separately identified');
 assert.match(proof.previousStableArchiveSha256,HASH);
 for(const f of ['backupEvidenceSha256','restoreEvidenceSha256','recoveryEvidenceSha256'])
   assert.match(proof[f],HASH);
 assert.ok(Number.isSafeInteger(proof.installedSchema)&&proof.installedSchema>=3);
 assert.ok(Number.isSafeInteger(proof.repairTargetSchema)&&
   proof.repairTargetSchema>=proof.installedSchema,'Cannot downgrade installed journal schema');
 assert.equal(proof.backupFormat,'portable-v1-encrypted');
 assert.equal(proof.offDeviceEncrypted,true,'Encrypted off-device backup required');
 assert.equal(proof.profileKind,'disposable','No protected live profile recovery');
 assert.ok(['forward-compatible-fix','fresh-compatible-profile-restore'].includes(proof.method));
 for(const f of ['clearOriginStorage','purgeCaches','downgradeSchema','modifyLiveRecords'])
   assert.equal(proof[f],false,'No destructive or protected recovery operation');
 assert.ok(PRIVACY_SAFE.includes(proof.claimedOutcome),'Cannot auto-approve recovery');
 const backup=reviewRows.find(row=>row.receipt?.subjectType==='migration-backup' &&
   row.receipt.subjectId==='encrypted-off-device-backup-restore' &&
   row.receipt.sourceCommit===sourceCommit && row.receipt.decision==='accept');
 assert.ok(backup,'Forward recovery requires separately signed encrypted-backup witness');
 assert.equal(backup.receipt.evidenceSha256,proof.backupEvidenceSha256,
   'Backup digest must match signed exact-source receipt');
 return {prepared:true,backupReceiptCorrelated:true,physicalRecoveryIndependentlyVerified:false};
}
/** P20 evidence must be recalculated first. All human rights/device/recovery results stay unverified. */
export function inspectP21Evidence({
 sourceCommit,p20Input,hostPacket,physicalPackets=[],recoveryPacket=null,
}) {
 assert.match(sourceCommit,SHA);
 assert.equal(p20Input.sourceCommit,sourceCommit);
 const p20=inspectP20Escalation(p20Input);
 assert.equal(p20.releaseAuthorized,false);
 const site=p20Input.p19Input.p18Input.handoff.originalSiteUrl;
 checkSource(sourceCommit,site,hostPacket);
 const rows=p20Input.p19Input.p18Input.closureInput.records;
 const physical=checkDevices(sourceCommit,physicalPackets,rows);
 const recovery=recoveryPacket===null?{prepared:false,physicalRecoveryIndependentlyVerified:false}:
   checkRecovery(sourceCommit,site,recoveryPacket,rows);
 return {
   sourceCommit,operatorHoldDigestSha256:p20.operatorHoldDigestSha256,
   immutableReleaseZipSha256:p20.immutableReleaseZipSha256,
   rotationIntentDigestSha256:p20.rotationIntentDigestSha256,
   originalSiteUrl:site,hostEvidenceDigestSha256:sha256(Buffer.from(
      'MDD-P21-SOURCE-RIGHTS-V1\n'+canonical(hostPacket))),
   physicalClaimCounts:physical,recoveryClaim:recovery,
   originAndPwaScopeStructurallyChecked:true,
   sourceRightsIndependentlyApproved:false,cdnRightsIndependentlyApproved:false,
   physicalDeviceOrAccessibilityHumanReviewVerified:false,
   backupRestoreActuallyPerformed:false,previousStableRestoreActuallyPerformed:false,
   independentSignersAuthenticated:false,productionReleaseCertified:false,
   releaseAuthorized:false,mergeAuthorized:false,deployAuthorized:false,
   publicationAuthorized:false,actionsPerformed:false,
 };
}
