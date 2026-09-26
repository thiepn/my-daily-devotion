import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { normalizeUsjBook } from "./build-bsb.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const [sourceRaw, packageRaw, app, main, reader, repository, manifestRaw] = await Promise.all([
  read("canonical/bsb/source-manifest.json"),
  read("package.json"),
  read("src/app/App.tsx"),
  read("src/main.tsx"),
  read("src/scripture/BibleScreen.tsx"),
  read("src/scripture/repository.ts"),
  read("public/bible/manifest.json"),
]);
// Visual imports moved to the single layered entrypoint; domain gates are unchanged.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);


const source = JSON.parse(sourceRaw);
const pkg = JSON.parse(packageRaw);
const manifest = JSON.parse(manifestRaw);
const referenceLimits = JSON.parse(await read("src/scripture/reference-limits.json"));

assert.equal(source.source.deterministicMirror.release, "v5.9");
assert.equal(source.source.deterministicMirror.asset, "BSB_usj.zip");
assert.match(source.source.deterministicMirror.sha256, /^[a-f0-9]{64}$/);
assert.equal(manifest.translationId, "BSB");
assert.equal(manifest.books.length, 66);
assert.ok(manifest.totalVerses >= 31000);
assert.equal(manifest.source.sha256, source.source.deterministicMirror.sha256);
const parserVersion = /^mdd-usj-normalizer\/(\d+)$/.exec(manifest.parserVersion);
assert.ok(parserVersion, `Unexpected BSB parser version: ${manifest.parserVersion}`);
assert.ok(Number(parserVersion[1]) >= 2, `BSB parser version must retain the Phase 3 fixes: ${manifest.parserVersion}`);

for (const book of manifest.books) {
  assert.ok(book.chapterCount > 0, `${book.id} must have chapters`);
  await access(new URL(`public${book.path}`, root));
  const asset = JSON.parse(await read(`public${book.path}`));
  assert.deepEqual(referenceLimits[book.id], asset.chapters.map((chapter) => Math.max(...chapter.blocks.flatMap((block) => block.segments.map((segment) => segment.verse ?? 0)))), `${book.id} restore reference bounds must match the pinned BSB assets`);
}

assert.ok(pkg.scripts["bible:build"]);
assert.ok(pkg.scripts["verify:phase3"]);
assert.equal(pkg.dependencies.fflate, "0.8.3");
assert.match(app, /BibleScreen/);
assert.match(app, /\/bible\/:bookId\/:chapter/);
assert.ok(styles.includes("scripture.css"));
assert.match(reader, /toggleHighlight/);
assert.match(reader, /toggleBookmark/);
assert.match(reader, /IntersectionObserver/);
assert.match(repository, /saveReaderPosition/);
assert.match(repository, /HIGHLIGHT_CREATED/);

const sample = normalizeUsjBook({
  type: "USJ",
  version: "3.1",
  content: [
    { type: "book", marker: "id", code: "PSA", content: [] },
    { type: "chapter", marker: "c", number: "1", sid: "PSA 1" },
    { type: "para", marker: "d", content: [
      "A superscription ",
      { type: "verse", marker: "v", number: "1", sid: "PSA 1:1" },
      "Blessed text",
    ] },
    { type: "para", marker: "q1", content: [
      { type: "verse", marker: "v", number: "2", sid: "PSA 1:2" },
      { type: "char", marker: "wj", content: ["A poetic line"] },
    ] },
  ],
}, { order: 19, id: "PSA", name: "Psalms", testament: "OT" });

assert.equal(sample.chapterCount, 1);
assert.equal(sample.chapters[0].blocks[0].kind, "superscription");
assert.equal(sample.chapters[0].blocks[0].segments.at(-1).verseKey, "PSA.1.1");
assert.equal(sample.chapters[0].blocks[1].segments[0].verseKey, "PSA.1.2");
assert.equal(sample.chapters[0].blocks[1].segments[0].redLetter, true);
assert.equal(sample.chapters[0].verseCount, 2);

console.log("✓ Phase 3 Scripture-platform verification passed");
console.log(`  ${manifest.books.length} normalized BSB books · ${manifest.totalVerses} verse identities`);
console.log("  semantic paragraphs, headings, poetry, superscriptions and red-letter spans preserved");
console.log("  reader position, highlight and bookmark persistence wired to Dexie");
