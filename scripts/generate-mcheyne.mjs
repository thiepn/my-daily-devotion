import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CANON_PATH = join(ROOT, "canonical/scripture/canon.json");
const SOURCE_MANIFEST_PATH = join(ROOT, "canonical/mcheyne/source-manifest.json");
const BIBLE_BOOKS_DIR = join(ROOT, "public/bible/books");
const OUTPUT_PATH = join(ROOT, "canonical/mcheyne/plan.v1.json");

const MONTHS = new Map([
  ["January", "01"], ["February", "02"], ["March", "03"], ["April", "04"],
  ["May", "05"], ["June", "06"], ["July", "07"], ["August", "08"],
  ["September", "09"], ["October", "10"], ["November", "11"], ["December", "12"],
]);

function normalizeAlias(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function createBookAliases(canon) {
  const aliases = new Map();
  for (const book of canon.books) aliases.set(normalizeAlias(book.name), book.id);
  const extra = {
    Psalm: "PSA",
    Psalms: "PSA",
    Songs: "SNG",
    "Song of Songs": "SNG",
    "Song of Solomon": "SNG",
    Canticles: "SNG",
  };
  for (const [name, id] of Object.entries(extra)) aliases.set(normalizeAlias(name), id);
  return [...aliases.entries()].sort((a, b) => b[0].length - a[0].length);
}

function splitReference(input, aliases) {
  const normalized = normalizeAlias(input);
  for (const [alias, bookId] of aliases) {
    if (!normalized.startsWith(`${alias} `)) continue;
    const wordCount = alias.split(" ").length;
    const location = input.split(/\s+/).slice(wordCount).join(" ").trim();
    return { bookId, location };
  }
  throw new Error(`Unknown M'Cheyne book name in reference: ${input}`);
}

function referenceLocation(location) {
  const match = /^(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/.exec(location);
  if (!match) throw new Error(`Unsupported M'Cheyne reference shape: ${location}`);
  const firstChapter = Number(match[1]);
  const firstVerse = match[2] ? Number(match[2]) : null;
  const tail = match[3] ? Number(match[3]) : null;
  const tailVerse = match[4] ? Number(match[4]) : null;

  if (firstVerse !== null) {
    if (tail === null) {
      return { startChapter: firstChapter, startVerse: firstVerse, endChapter: firstChapter, endVerse: firstVerse };
    }
    if (tailVerse === null) {
      return { startChapter: firstChapter, startVerse: firstVerse, endChapter: firstChapter, endVerse: tail };
    }
    return { startChapter: firstChapter, startVerse: firstVerse, endChapter: tail, endVerse: tailVerse };
  }

  return {
    startChapter: firstChapter,
    startVerse: null,
    endChapter: tail ?? firstChapter,
    endVerse: null,
  };
}

function splitLocations(location) {
  if (!location.includes(",")) return [location];
  const parts = location.split(",").map((value) => value.trim()).filter(Boolean);
  if (parts.length < 2) throw new Error(`Invalid segmented M'Cheyne reference: ${location}`);
  if (!parts.every((part) => /^\d+(?:-\d+)?$/.test(part))) {
    throw new Error(`Unsupported segmented M'Cheyne reference shape: ${location}`);
  }
  return parts;
}

function chapterVerseNumbers(book, chapterNumber) {
  const chapter = book.chapters.find((item) => item.chapter === chapterNumber);
  if (!chapter) throw new Error(`${book.bookId} has no chapter ${chapterNumber}`);
  const numbers = new Set();
  for (const block of chapter.blocks) {
    for (const segment of block.segments) {
      if (Number.isInteger(segment.verse)) numbers.add(segment.verse);
    }
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error(`${book.bookId} ${chapterNumber} contains no verse identities`);
  return sorted;
}

async function loadBook(bookId, cache) {
  if (cache.has(bookId)) return cache.get(bookId);
  const book = JSON.parse(await readFile(join(BIBLE_BOOKS_DIR, `${bookId}.json`), "utf8"));
  cache.set(bookId, book);
  return book;
}

async function structuralRange(bookId, location, book) {
  const parsed = referenceLocation(location);
  const startNumbers = chapterVerseNumbers(book, parsed.startChapter);
  const endNumbers = parsed.endChapter === parsed.startChapter ? startNumbers : chapterVerseNumbers(book, parsed.endChapter);
  const startVerse = parsed.startVerse ?? startNumbers[0];
  const endVerse = parsed.endVerse ?? endNumbers.at(-1);
  if (!startNumbers.includes(startVerse)) throw new Error(`${bookId} ${location}: start verse ${startVerse} does not exist in BSB`);
  if (!endNumbers.includes(endVerse)) throw new Error(`${bookId} ${location}: end verse ${endVerse} does not exist in BSB`);
  return {
    translationId: "BSB",
    startVerseKey: `${bookId}.${parsed.startChapter}.${startVerse}`,
    endVerseKey: `${bookId}.${parsed.endChapter}.${endVerse}`,
  };
}

async function normalizeReference(input, aliases, canonById, bookCache) {
  const { bookId, location } = splitReference(input.trim(), aliases);
  const book = await loadBook(bookId, bookCache);
  const references = [];
  for (const part of splitLocations(location)) references.push(await structuralRange(bookId, part, book));

  const canonicalBook = canonById.get(bookId);
  const displayBook = bookId === "PSA" ? "Psalm" : bookId === "SNG" ? "Song of Songs" : canonicalBook.name;
  return {
    displayReference: `${displayBook} ${location}`,
    references,
  };
}

function parseScheduleLine(line) {
  const match = /^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{2}),\s+2011\s+---\s+(.+?)\s*$/.exec(line);
  if (!match) return null;
  const month = MONTHS.get(match[1]);
  if (!month) throw new Error(`Unknown month: ${match[1]}`);
  const readings = match[3].split(" - ").map((value) => value.trim());
  if (readings.length !== 4) throw new Error(`Expected four readings: ${line}`);
  return { calendarKey: `${month}-${match[2]}`, readings };
}

async function fetchPinnedSchedule(sourceManifest) {
  const source = sourceManifest.materializationSource;
  if (!source?.rawUrl) throw new Error("M'Cheyne materializationSource.rawUrl is missing");
  const response = await fetch(source.rawUrl, { redirect: "follow" });
  if (!response.ok) throw new Error(`Unable to fetch pinned M'Cheyne schedule: ${response.status} ${response.statusText}`);
  return response.text();
}

function verifyAnchors(plan, sourceManifest) {
  for (const anchor of sourceManifest.verificationAnchors) {
    const assignment = plan.assignments.find((item) => item.calendarKey === anchor.calendarKey);
    assert.ok(assignment, `Missing anchor assignment ${anchor.calendarKey}`);
    assert.equal(assignment.sequence, anchor.sequence, `Sequence mismatch at ${anchor.calendarKey}`);
    assert.deepEqual(assignment.readings.slice(0, 2).map((item) => item.displayReference), anchor.family);
    assert.deepEqual(assignment.readings.slice(2).map((item) => item.displayReference), anchor.secret);
  }
}

export async function generateMcheynePlan() {
  const [canon, sourceManifest] = await Promise.all([
    readFile(CANON_PATH, "utf8").then(JSON.parse),
    readFile(SOURCE_MANIFEST_PATH, "utf8").then(JSON.parse),
  ]);
  const aliases = createBookAliases(canon);
  const canonById = new Map(canon.books.map((book) => [book.id, book]));
  const scheduleText = await fetchPinnedSchedule(sourceManifest);
  const schedule = scheduleText.split(/\r?\n/).map(parseScheduleLine).filter(Boolean);
  assert.equal(schedule.length, 365, `Expected 365 canonical assignments, found ${schedule.length}`);
  assert.equal(new Set(schedule.map((item) => item.calendarKey)).size, 365, "Calendar keys must be unique");
  assert.ok(!schedule.some((item) => item.calendarKey === "02-29"), "February 29 must not have a canonical assignment");

  const bookCache = new Map();
  const assignments = [];
  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const readings = [];
    for (let readingIndex = 0; readingIndex < 4; readingIndex += 1) {
      const normalized = await normalizeReference(item.readings[readingIndex], aliases, canonById, bookCache);
      readings.push({
        group: readingIndex < 2 ? "family" : "secret",
        ...normalized,
      });
    }
    assignments.push({ sequence: index + 1, calendarKey: item.calendarKey, readings });
  }

  const plan = { planId: "mcheyne-classic", version: 1, assignments };
  verifyAnchors(plan, sourceManifest);
  await mkdir(join(ROOT, "canonical/mcheyne"), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const rangeCount = assignments.reduce((sum, assignment) => sum + assignment.readings.reduce((inner, reading) => inner + reading.references.length, 0), 0);
  console.log(`✓ Materialized M'Cheyne plan: ${assignments.length} assignments · ${assignments.length * 4} readings · ${rangeCount} structural ranges`);
}

generateMcheynePlan().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
