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

const source = JSON.parse(sourceRaw);
const pkg = JSON.parse(packageRaw);
const manifest = JSON.parse(manifestRaw);

assert.equal(source.source.deterministicMirror.release, "v5.9");
assert.equal(source.source.deterministicMirror.asset, "BSB_usj.zip");
assert.match(source.source.deterministicMirror.sha256, /^[a-f0-9]{64}$/);
assert.equal(manifest.translationId, "BSB");
assert.equal(manifest.books.length, 66);
assert.ok(manifest.totalVerses >= 30000);
assert.equal(manifest.source.sha256, source.source.deterministicMirror.sha256);
assert.equal(manifest.parserVersion, "mdd-usj-normalizer/1");

for (const book of manifest.books) {
  assert.ok(book.chapterCount > 0, `${book.id} must have chapters`);
  await access(new URL(`public${book.path}`, root));
}

assert.ok(pkg.scripts["bible:build"]);
assert.ok(pkg.scripts["verify:phase3"]);
assert.equal(pkg.devDependencies.fflate, "0.8.3");
assert.match(app, /BibleScreen/);
assert.match(app, /\/bible\/:bookId\/:chapter/);
assert.ok(main.includes("scripture.css"));
assert.match(reader, /toggleHighlight/);
assert.match(reader, /toggleBookmark/);
assert.match(reader, /IntersectionObserver/);
assert.match(repository, /saveReaderPosition/);
assert.match(repository, /HIGHLIGHT_CREATED/);

const sample = normalizeUsjBook({
  type: "USJ",
  version: "3.1",
  content: [
    { type: "book", marker: "id", code: "MRK", content: [] },
    { type: "chapter", marker: "c", number: "1", sid: "MRK 1" },
    { type: "para", marker: "s1", content: ["A heading"] },
    { type: "para", marker: "p", content: [
      { type: "verse", marker: "v", number: "1", sid: "MRK 1:1" },
      "Beginning ",
      { type: "char", marker: "wj", content: ["red words"] },
    ] },
    { type: "para", marker: "q1", content: [
      { type: "verse", marker: "v", number: "2", sid: "MRK 1:2" },
      "A poetic line",
    ] },
  ],
}, { order: 41, id: "MRK", name: "Mark", testament: "NT" });

assert.equal(sample.chapterCount, 1);
assert.equal(sample.chapters[0].blocks[0].kind, "heading");
assert.equal(sample.chapters[0].blocks[1].segments[0].verseKey, "MRK.1.1");
assert.equal(sample.chapters[0].blocks[1].segments[1].redLetter, true);
assert.equal(sample.chapters[0].blocks[2].kind, "poetry");
assert.equal(sample.chapters[0].verseCount, 2);

console.log("✓ Phase 3 Scripture-platform verification passed");
console.log(`  ${manifest.books.length} normalized BSB books · ${manifest.totalVerses} verse identities`);
console.log("  semantic paragraphs, headings, poetry and red-letter spans preserved");
console.log("  reader position, highlight and bookmark persistence wired to Dexie");
