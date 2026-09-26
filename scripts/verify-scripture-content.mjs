import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scriptureTextForRange } from "../src/scripture/plain-text.ts";
const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const [manifest, documents, plan, quoteFixtures] = await Promise.all([
  read("public/bible/manifest.json"), read("public/bible/search-index.json"),
  read("canonical/mcheyne/plan.v1.json"), read("scripts/fixtures/scripture-quote-boundaries.json"),
]);
assert.equal(plan.assignments.length, 365);
assert.equal(new Set(plan.assignments.map((day) => day.calendarKey)).size, 365);
const byKey = new Map(documents.map((verse, index) => [verse.verseKey, { ...verse, index }]));
assert.equal(byKey.size, documents.length);
const coverage = new Uint8Array(documents.length);
for (const [index, assignment] of plan.assignments.entries()) {
  assert.equal(assignment.sequence, index + 1);
  assert.notEqual(assignment.calendarKey, "02-29");
  assert.equal(assignment.readings.length, 4);
  for (const reading of assignment.readings) for (const reference of reading.references) {
    const start = byKey.get(reference.startVerseKey), end = byKey.get(reference.endVerseKey);
    assert.ok(start && end, `Missing plan endpoint: ${reading.displayReference}`);
    assert.ok(start.index <= end.index, `Reversed plan range: ${reading.displayReference}`);
    for (let i = start.index; i <= end.index; i += 1) coverage[i] += 1;
  }
}
for (const [index, verse] of documents.entries()) {
  assert.equal(coverage[index], verse.testament === "NT" || verse.bookId === "PSA" ? 2 : 1, `Annual coverage: ${verse.verseKey}`);
  assert.doesNotMatch(verse.text, /”[\p{L}\p{N}]/u, `Missing quotation word boundary: ${verse.verseKey}`);
}
for (const fixture of quoteFixtures) assert.equal(byKey.get(fixture.verseKey)?.text, fixture.text, fixture.verseKey);
const noteBoundaries = await read("docs/scripture/omitted-note-boundaries.json");
for (const fixture of noteBoundaries) {
  assert.equal(fixture.before.replace(/\s/g, ""), fixture.after.replace(/\s/g, ""), `Whitespace-only correction: ${fixture.verse}`);
  assert.equal(byKey.get(fixture.verse)?.text, fixture.after, `Omitted-note boundary: ${fixture.verse}`);
}
for (const book of manifest.books) {
  const asset = await read(`public/bible/books/${book.id}.json`);
  for (const chapter of asset.chapters) {
    const verses = documents.filter((verse) => verse.bookId === book.id && verse.chapter === chapter.chapter);
    for (const verse of verses) assert.equal(scriptureTextForRange(chapter, verse.verse), verse.text, `Reader/copy/search agreement: ${verse.verseKey}`);
    if (verses.length) assert.equal(scriptureTextForRange(chapter, verses[0].verse, verses.at(-1).verse), verses.map((verse) => verse.text).join(" "), `Whole-chapter copy: ${book.id}.${chapter.chapter}`);
  }
}
console.log(`✓ Complete Scripture verification: ${documents.length} verse identities, all 365 assignments, ${quoteFixtures.length} quotation and ${noteBoundaries.length} omitted-note regressions; reader/copy/search text agrees.`);
