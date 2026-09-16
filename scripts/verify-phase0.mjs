import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function json(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equalArray(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array`);
  assert(actual.length === expected.length, `${label} length mismatch`);
  expected.forEach((value, index) => {
    assert(actual[index] === value, `${label}[${index}] expected ${value}, got ${actual[index]}`);
  });
}

function sequenceForCalendarKey(calendarKey) {
  const [month, day] = calendarKey.split('-').map(Number);
  const current = Date.UTC(2025, month - 1, day);
  const jan1 = Date.UTC(2025, 0, 1);
  return Math.floor((current - jan1) / 86_400_000) + 1;
}

const canon = await json('canonical/scripture/canon.json');
const bsb = await json('canonical/bsb/source-manifest.json');
const mcheyne = await json('canonical/mcheyne/source-manifest.json');
const domain = await json('canonical/domain-contract.v1.json');
await json('canonical/scripture/reference.schema.json');
await json('canonical/mcheyne/plan.schema.json');
await json('canonical/backup/manifest.schema.json');

// Scripture canon
assert(canon.schemaVersion === 1, 'Scripture canon schemaVersion must be 1');
assert(canon.canon === 'protestant-66', 'Scripture canon must be protestant-66');
assert(canon.bookIdStandard === 'USFM', 'Book IDs must use USFM identifiers');
assert(canon.books.length === 66, `Expected 66 canonical books, got ${canon.books.length}`);
assert(new Set(canon.books.map((b) => b.id)).size === 66, 'Canonical book IDs must be unique');
assert(new Set(canon.books.map((b) => b.name)).size === 66, 'Canonical book names must be unique');
canon.books.forEach((book, index) => {
  assert(book.order === index + 1, `Book ${book.id} has invalid canonical order`);
  assert(['OT', 'NT'].includes(book.testament), `Book ${book.id} has invalid testament`);
});
assert(canon.books.filter((b) => b.testament === 'OT').length === 39, 'Expected 39 OT books');
assert(canon.books.filter((b) => b.testament === 'NT').length === 27, 'Expected 27 NT books');

// BSB provenance
assert(bsb.translationId === 'BSB', 'Canonical translationId must be BSB');
assert(bsb.license.status === 'public-domain', 'BSB license contract must be public-domain');
assert(bsb.license.effectiveDate === '2023-04-30', 'Unexpected BSB public-domain effective date');
assert(bsb.source.preferredFormat === 'USJ', 'USJ must remain the preferred BSB ingest source');
assert(bsb.source.fallbackFormat === 'USFM', 'USFM must remain the BSB fallback ingest source');
assert(bsb.source.preferredDownload.startsWith('https://'), 'BSB preferred source must use HTTPS');
assert(bsb.ingestionContract.forbidVerseOnlyFlattening === true, 'Verse-only Bible flattening must remain forbidden');
assert(bsb.ingestionContract.requireSha256ForImportedSource === true, 'BSB imports must record SHA-256');

// Scripture identity
const verseKey = new RegExp(domain.scripture.verseKeyPattern);
['GEN.1.1', 'JHN.3.16', '1CO.13.4'].forEach((key) => assert(verseKey.test(key), `Valid verse key rejected: ${key}`));
['GEN.0.1', 'GEN.1.0', 'John.3.16', 'JHN-3-16'].forEach((key) => assert(!verseKey.test(key), `Invalid verse key accepted: ${key}`));

// M'Cheyne calendar
assert(mcheyne.planId === 'mcheyne-classic', 'Unexpected MCheyne plan id');
assert(mcheyne.assignmentCount === 365, 'MCheyne plan must contain 365 assignments');
assert(mcheyne.readingsPerAssignment === 4, 'MCheyne assignments must contain four readings');
assert(mcheyne.groups.length === 2, 'MCheyne plan must have two canonical groups');
assert(mcheyne.groups.find((g) => g.id === 'family')?.countPerDay === 2, 'Family group must have two readings');
assert(mcheyne.groups.find((g) => g.id === 'secret')?.countPerDay === 2, 'Secret group must have two readings');
assert(mcheyne.calendarContract.feb29Assignment === null, 'February 29 must have no canonical assignment');
assert(mcheyne.calendarContract.shiftAfterLeapDay === false, 'Leap years must not shift March onward');
assert(mcheyne.calendarContract.completionMode === 'explicit', 'Reading completion must remain explicit');
assert(mcheyne.calendarContract.openingDoesNotComplete === true, 'Opening a reading must not complete it');
assert(mcheyne.calendarContract.scrollingDoesNotComplete === true, 'Scrolling must not complete a reading');
assert(mcheyne.calendarContract.streaks === false, 'MDD must not add streak semantics to MCheyne');
assert(new Set(mcheyne.verificationAnchors.map((a) => a.calendarKey)).size === mcheyne.verificationAnchors.length, 'Mcheyne anchors must be unique');
for (const anchor of mcheyne.verificationAnchors) {
  assert(sequenceForCalendarKey(anchor.calendarKey) === anchor.sequence, `MCheyne anchor sequence mismatch at ${anchor.calendarKey}`);
  assert(anchor.family.length === 2 && anchor.secret.length === 2, `MCheyne anchor ${anchor.calendarKey} must contain four readings`);
}

// Date/time semantics
assert(domain.time.localDate === 'YYYY-MM-DD', 'LocalDate contract changed');
assert(domain.time.instant === 'UTC-ISO-8601-Z', 'Instant contract changed');
assert(domain.time.timeZone === 'IANA', 'Timezone contract changed');
assert(domain.time.devotionBoundary === 'civil-midnight', 'Devotional day boundary changed');
assert(domain.time.historicalLocalDatesShiftWithTimezone === false, 'Historical local dates must not shift with timezone');

// Prayer lifecycle
const expectedStatuses = ['ACTIVE', 'WAITING', 'ANSWERED', 'ARCHIVED'];
equalArray(domain.prayer.statuses, expectedStatuses, 'Prayer statuses');
const expectedTransitions = new Set([
  'ACTIVE>WAITING',
  'WAITING>ACTIVE',
  'ACTIVE>ANSWERED',
  'WAITING>ANSWERED',
  'ACTIVE>ARCHIVED',
  'WAITING>ARCHIVED',
  'ANSWERED>ARCHIVED'
]);
const transitions = new Set(domain.prayer.allowedTransitions.map(([from, to]) => `${from}>${to}`));
assert(transitions.size === expectedTransitions.size, 'Prayer transition count changed');
for (const transition of expectedTransitions) assert(transitions.has(transition), `Missing prayer transition ${transition}`);

equalArray(
  domain.prayer.scheduleModes,
  ['ROTATION', 'DAILY', 'WEEKDAYS', 'INTERVAL_DAYS', 'MONTHLY', 'ON_DATE', 'MANUAL_ONLY'],
  'Prayer schedule modes'
);
assert(domain.prayer.missedRecurrenceCreatesDebt === false, 'Missed prayer recurrence must not create debt');
assert(domain.prayer.priorityField === false, 'Priority field must remain absent');
assert(domain.prayer.focusIsTemporary === true, 'Focus must remain temporary');

equalArray(
  domain.prayer.queue.precedence,
  ['FOCUS_OR_EVENT', 'FIXED_DUE', 'NEVER_PRAYED', 'ROTATION'],
  'Prayer queue precedence'
);
equalArray(
  domain.prayer.queue.rotationSort,
  ['lastPrayedAt:null-first', 'lastPrayedAt:asc', 'createdAt:asc', 'id:asc'],
  'Prayer rotation sort'
);
assert(domain.prayer.queue.dedupeAfterEachBand === true, 'Queue must dedupe after each precedence band');
assert(domain.prayer.queue.nextUpdatesLastPrayedAt === true, 'Next must update lastPrayedAt');
assert(domain.prayer.queue.skipUpdatesLastPrayedAt === false, 'Skip must not update lastPrayedAt');

// History vocabulary
const activityTypes = domain.activityEventTypes;
assert(new Set(activityTypes).size === activityTypes.length, 'Activity event types must be unique');
for (const required of ['READING_COMPLETED', 'REFLECTION_CREATED', 'PRAYER_PRAYED', 'PRAYER_ANSWERED']) {
  assert(activityTypes.includes(required), `Missing required activity type ${required}`);
}

// Backup/migration baseline
assert(domain.databaseInitialSchemaVersion === 1, 'Initial database schema version must be 1');
assert(domain.backup.formatId === 'mdd-backup', 'Backup format identifier changed');
assert(domain.backup.extension === '.mddbackup', 'Backup extension changed');
assert(domain.backup.formatVersion === 1, 'Backup format version changed unexpectedly');
assert(domain.backup.requiredEntries.includes('manifest.json'), 'Backup must include manifest.json');
assert(domain.backup.requiredEntries.includes('data.json'), 'Backup must include data.json');
assert(domain.backup.checksumsRequired === true, 'Backup checksums must remain required');
assert(domain.backup.failedImportMustPreserveExistingDatabase === true, 'Failed imports must preserve current data');
assert(domain.backup.encryptedBackupRequired === true, 'Encrypted backup remains a V1 requirement');

// Scope guardrails
for (const forbidden of ['cloud-sync', 'streaks', 'xp', 'badges', 'ai-generated-prayers', 'social-feed']) {
  assert(domain.explicitNonGoalsV1.includes(forbidden), `V1 non-goal missing: ${forbidden}`);
}
assert(domain.sync.v1 === false, 'Cloud sync must remain outside V1');
assert(domain.sync.localWriteIsPrimary === true, 'Local write must remain primary');

console.log('✓ Phase 0 canonical contract verification passed');
console.log(`  ${canon.books.length} canonical Scripture books`);
console.log(`  ${mcheyne.assignmentCount} M'Cheyne calendar assignments contracted`);
console.log(`  ${domain.prayer.statuses.length} prayer lifecycle states`);
console.log(`  ${domain.activityEventTypes.length} meaningful activity event types`);
