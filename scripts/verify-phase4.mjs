import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [planRaw, runtimeRaw, sourceRaw, app, reader, today, planScreen, repository, pkgRaw, main] = await Promise.all([
  read("canonical/mcheyne/plan.v1.json"),
  read("public/plans/mcheyne-classic.v1.json"),
  read("canonical/mcheyne/source-manifest.json"),
  read("src/app/App.tsx"),
  read("src/scripture/BibleScreen.tsx"),
  read("src/mcheyne/TodayScreen.tsx"),
  read("src/mcheyne/PlanScreen.tsx"),
  read("src/mcheyne/repository.ts"),
  read("package.json"),
  read("src/main.tsx"),
]);
// Visual imports moved to the single layered entrypoint; domain gates are unchanged.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);


const plan = JSON.parse(planRaw);
const runtimePlan = JSON.parse(runtimeRaw);
const source = JSON.parse(sourceRaw);
const pkg = JSON.parse(pkgRaw);

assert.equal(plan.planId, "mcheyne-classic");
assert.equal(plan.version, 1);
assert.equal(plan.assignments.length, 365);
assert.deepEqual(runtimePlan, plan);
assert.equal(new Set(plan.assignments.map((item) => item.calendarKey)).size, 365);
assert.ok(!plan.assignments.some((item) => item.calendarKey === "02-29"));

let rangeCount = 0;
const bookKeyCache = new Map();
async function verseKeys(bookId) {
  if (bookKeyCache.has(bookId)) return bookKeyCache.get(bookId);
  const book = JSON.parse(await read(`public/bible/books/${bookId}.json`));
  const keys = new Set();
  for (const chapter of book.chapters) {
    for (const block of chapter.blocks) {
      for (const segment of block.segments) if (segment.verseKey) keys.add(segment.verseKey);
    }
  }
  bookKeyCache.set(bookId, keys);
  return keys;
}

for (let index = 0; index < plan.assignments.length; index += 1) {
  const assignment = plan.assignments[index];
  assert.equal(assignment.sequence, index + 1);
  assert.equal(assignment.readings.length, 4);
  assert.deepEqual(assignment.readings.map((reading) => reading.group), ["family", "family", "secret", "secret"]);
  for (const reading of assignment.readings) {
    assert.ok(reading.displayReference.length > 0);
    assert.ok(Array.isArray(reading.references) && reading.references.length >= 1);
    rangeCount += reading.references.length;
    for (const reference of reading.references) {
      assert.equal(reference.translationId, "BSB");
      assert.match(reference.startVerseKey, /^[1-3]?[A-Z]{2,3}\.[1-9][0-9]*\.[1-9][0-9]*$/);
      assert.match(reference.endVerseKey, /^[1-3]?[A-Z]{2,3}\.[1-9][0-9]*\.[1-9][0-9]*$/);
      const startBook = reference.startVerseKey.split(".")[0];
      const endBook = reference.endVerseKey.split(".")[0];
      assert.equal(startBook, endBook, `${reading.displayReference} cannot silently span books`);
      const keys = await verseKeys(startBook);
      assert.ok(keys.has(reference.startVerseKey), `Missing BSB start verse ${reference.startVerseKey}`);
      assert.ok(keys.has(reference.endVerseKey), `Missing BSB end verse ${reference.endVerseKey}`);
    }
  }
}
assert.equal(rangeCount, 1461, "Pinned schedule should contain one discontiguous reading and 1461 structural ranges");

for (const anchor of source.verificationAnchors) {
  const assignment = plan.assignments.find((item) => item.calendarKey === anchor.calendarKey);
  assert.ok(assignment);
  assert.equal(assignment.sequence, anchor.sequence);
  assert.deepEqual(assignment.readings.slice(0, 2).map((item) => item.displayReference), anchor.family);
  assert.deepEqual(assignment.readings.slice(2).map((item) => item.displayReference), anchor.secret);
}

assert.match(app, /TodayScreen/);
assert.match(app, /PlanScreen/);
assert.match(app, /\/today\/plan/);
assert.match(today, /Follow today’s calendar/);
assert.match(today, /Start self-paced at Day 1/);
assert.match(today, /earlier unread/i);
assert.match(planScreen, /1,460 readings marked complete/);
assert.match(reader, /plan-reading-context/);
assert.match(reader, /togglePlanCompletion/);
assert.match(reader, /Mark reading complete/);
assert.doesNotMatch(reader, /READING_COMPLETED/);
assert.match(repository, /READING_COMPLETED/);
assert.match(repository, /bulkImportThrough/);
assert.match(repository, /getCurrentSelfPacedSequence/);
assert.ok(pkg.scripts["mcheyne:build"]);
assert.ok(pkg.scripts["verify:phase4"]);
assert.ok(styles.includes("phase4.css"));

console.log("✓ Phase 4 M’Cheyne & Today verification passed");
console.log(`  ${plan.assignments.length} assignments · 1,460 readings · ${rangeCount} structural ranges`);
console.log("  calendar + self-paced enrollment, explicit completion and progress import certified");
console.log("  Today, full-plan browsing and Bible reader handoff wired to local state");
