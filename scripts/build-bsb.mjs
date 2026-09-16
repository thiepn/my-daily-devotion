import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { strFromU8, unzipSync } from "fflate";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CANON_PATH = join(ROOT, "canonical/scripture/canon.json");
const SOURCE_PATH = join(ROOT, "canonical/bsb/source-manifest.json");
const OUTPUT_DIR = join(ROOT, "public/bible");
const BOOKS_DIR = join(OUTPUT_DIR, "books");
const SEARCH_FILE = join(OUTPUT_DIR, "search-index.json");
const PARSER_VERSION = "mdd-usj-normalizer/3";
const NORMALIZED_DATA_VERSION = 1;

function textContent(content) {
  if (!Array.isArray(content)) return "";
  return content.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    if (item.type === "verse" || item.type === "chapter") return "";
    return textContent(item.content);
  }).join("").replace(/\s+/g, " ").trim();
}
function blockKind(marker = "") {
  if (/^(?:s\d?|ms\d?|mr|r|qa)$/.test(marker)) return "heading";
  if (/^(?:d|sp)$/.test(marker)) return "superscription";
  if (/^(?:q\d?|qm\d?|qr|qc)$/.test(marker)) return "poetry";
  if (marker === "b") return "blank";
  return "paragraph";
}
function blockLevel(marker = "") { const match = marker.match(/(\d+)$/); return match ? Number(match[1]) : 1; }
function sidToVerseKey(sid) { if (typeof sid !== "string") return null; const match = /^([1-3]?[A-Z]{2,3})\s+(\d+):(\d+)/.exec(sid); return match ? `${match[1]}.${Number(match[2])}.${Number(match[3])}` : null; }
function verseFromKey(key) { if (!key) return null; const value = Number(key.split(".")[2]); return Number.isFinite(value) ? value : null; }
function appendSegment(segments, segment) {
  if (!segment.text) return;
  const previous = segments.at(-1);
  if (previous && !segment.isVerseStart && previous.verseKey === segment.verseKey && previous.redLetter === segment.redLetter && previous.emphasis === segment.emphasis) { previous.text += segment.text; return; }
  segments.push(segment);
}

export function normalizeUsjBook(usj, bookMeta) {
  if (!usj || usj.type !== "USJ" || !Array.isArray(usj.content)) throw new Error(`Invalid USJ payload for ${bookMeta.id}`);
  const bookNode = usj.content.find((node) => node?.type === "book");
  if (!bookNode || bookNode.code !== bookMeta.id) throw new Error(`Book identity mismatch: expected ${bookMeta.id}, received ${bookNode?.code ?? "unknown"}`);
  const chapters = []; let chapter = null; let currentVerseKey = null; let nextIsVerseStart = false;
  const beginChapter = (node) => { const number = Number(node.number); if (!Number.isInteger(number) || number < 1) return; chapter = { chapter: number, blocks: [], notes: [], verseCount: 0 }; chapters.push(chapter); currentVerseKey = null; nextIsVerseStart = false; };
  const walkContent = (content, segments, notes, style = { redLetter: false, emphasis: null }) => {
    if (!Array.isArray(content)) return;
    for (const item of content) {
      if (typeof item === "string") {
        const text = item.replace(/\s+/g, " "); if (!text) continue;
        appendSegment(segments, { verseKey: currentVerseKey, verse: verseFromKey(currentVerseKey), text, isVerseStart: nextIsVerseStart, redLetter: style.redLetter, emphasis: style.emphasis }); nextIsVerseStart = false; continue;
      }
      if (!item || typeof item !== "object") continue;
      if (item.type === "verse") { if (item.number && item.sid) { currentVerseKey = sidToVerseKey(item.sid); nextIsVerseStart = currentVerseKey !== null; } continue; }
      if (item.type === "note") { const noteText = textContent(item.content); if (noteText) notes.push({ verseKey: currentVerseKey, marker: item.marker ?? "note", text: noteText }); continue; }
      const marker = typeof item.marker === "string" ? item.marker : "";
      const nextStyle = { redLetter: style.redLetter || marker === "wj", emphasis: style.emphasis ?? (/^(?:bd|bdit|em|it|k|nd|sc|sup)$/.test(marker) ? marker : null) };
      walkContent(item.content, segments, notes, nextStyle);
    }
  };
  for (const node of usj.content) {
    if (!node || typeof node !== "object") continue;
    if (node.type === "chapter" && node.number) { beginChapter(node); continue; }
    if (!chapter || !Array.isArray(node.content)) continue;
    const marker = typeof node.marker === "string" ? node.marker : "p"; const kind = blockKind(marker); const segments = []; const notes = [];
    if (kind === "heading" || kind === "superscription") { currentVerseKey = null; nextIsVerseStart = false; }
    walkContent(node.content, segments, notes);
    if (kind === "blank" || segments.some((segment) => segment.text.trim().length > 0)) chapter.blocks.push({ kind, marker, level: blockLevel(marker), segments });
    chapter.notes.push(...notes);
  }
  for (const item of chapters) {
    const keys = new Set();
    for (const block of item.blocks) for (const segment of block.segments) if (segment.verseKey) keys.add(segment.verseKey);
    item.verseCount = keys.size;
  }
  if (!chapters.length) throw new Error(`${bookMeta.id} contains no chapters`);
  return { schemaVersion: NORMALIZED_DATA_VERSION, translationId: "BSB", bookId: bookMeta.id, name: bookMeta.name, testament: bookMeta.testament, order: bookMeta.order, chapterCount: chapters.length, chapters };
}

function searchDocumentsForBook(book) {
  const docs = [];
  for (const chapter of book.chapters) {
    const verses = new Map();
    for (const block of chapter.blocks) {
      for (const segment of block.segments) {
        if (!segment.verseKey || segment.verse === null || !segment.text) continue;
        verses.set(segment.verseKey, `${verses.get(segment.verseKey) ?? ""}${segment.text}`);
      }
    }
    for (const [verseKey, text] of verses) {
      const verse = Number(verseKey.split(".")[2]);
      docs.push({ verseKey, bookId: book.bookId, bookName: book.name, testament: book.testament, order: book.order, chapter: chapter.chapter, verse, text: text.replace(/\s+/g, " ").trim() });
    }
  }
  return docs;
}
async function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function alreadyBuilt(expectedSha) {
  try {
    const manifest = JSON.parse(await readFile(join(OUTPUT_DIR, "manifest.json"), "utf8"));
    if (manifest.source?.sha256 !== expectedSha || manifest.books?.length !== 66 || manifest.parserVersion !== PARSER_VERSION || manifest.searchIndexPath !== "/bible/search-index.json") return false;
    await Promise.all([...manifest.books.map((book) => access(join(ROOT, "public", book.path.replace(/^\//, "")))), access(SEARCH_FILE)]); return true;
  } catch { return false; }
}
async function downloadPinnedSource(source) {
  const mirror = source.source.deterministicMirror; const urls = [mirror.download, source.source.preferredDownload]; let lastError = null;
  for (const url of urls) {
    try { const response = await fetch(url, { redirect: "follow" }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); const bytes = new Uint8Array(await response.arrayBuffer()); const digest = await sha256(bytes); if (digest !== mirror.sha256) throw new Error(`SHA-256 mismatch for ${url}: expected ${mirror.sha256}, received ${digest}`); return { bytes, url, digest }; }
    catch (error) { lastError = error; }
  }
  throw new Error(`Unable to download pinned BSB USJ source: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function buildBibleAssets({ force = false } = {}) {
  const [canon, source] = await Promise.all([readFile(CANON_PATH, "utf8").then(JSON.parse), readFile(SOURCE_PATH, "utf8").then(JSON.parse)]);
  const expectedSha = source.source.deterministicMirror.sha256;
  if (!force && await alreadyBuilt(expectedSha)) { console.log("✓ BSB normalized assets already match pinned source"); return; }
  const downloaded = await downloadPinnedSource(source); const archive = unzipSync(downloaded.bytes); const filesByBook = new Map();
  for (const [filename, bytes] of Object.entries(archive)) { if (!/\.usj$/i.test(filename)) continue; const usj = JSON.parse(strFromU8(bytes)); const code = usj.content?.find((node) => node?.type === "book")?.code; if (typeof code === "string") filesByBook.set(code, usj); }
  if (filesByBook.size !== 66) throw new Error(`Expected 66 USJ books, found ${filesByBook.size}`);
  await rm(OUTPUT_DIR, { recursive: true, force: true }); await mkdir(BOOKS_DIR, { recursive: true });
  const manifestBooks = []; const searchDocuments = []; let totalVerses = 0;
  for (const meta of canon.books) {
    const usj = filesByBook.get(meta.id); if (!usj) throw new Error(`Pinned archive is missing ${meta.id}`);
    const normalized = normalizeUsjBook(usj, meta); const bookPath = `/bible/books/${meta.id}.json`;
    await writeFile(join(BOOKS_DIR, `${meta.id}.json`), JSON.stringify(normalized), "utf8");
    totalVerses += normalized.chapters.reduce((sum, item) => sum + item.verseCount, 0); searchDocuments.push(...searchDocumentsForBook(normalized));
    manifestBooks.push({ order: meta.order, id: meta.id, name: meta.name, testament: meta.testament, chapterCount: normalized.chapterCount, path: bookPath });
  }
  if (totalVerses < 30000 || searchDocuments.length < 30000) throw new Error(`Normalized Scripture/search count is unexpectedly low: ${totalVerses}/${searchDocuments.length}`);
  await writeFile(SEARCH_FILE, JSON.stringify(searchDocuments), "utf8");
  const manifest = { schemaVersion: NORMALIZED_DATA_VERSION, translationId: "BSB", name: "Berean Standard Bible", editionLabel: source.editionLabel, parserVersion: PARSER_VERSION, normalizedDataVersion: NORMALIZED_DATA_VERSION, generatedAt: new Date().toISOString(), searchIndexPath: "/bible/search-index.json", source: { canonicalDownload: source.source.preferredDownload, downloadedFrom: downloaded.url, release: source.source.deterministicMirror.release, sha256: downloaded.digest, format: "USJ" }, totalVerses, books: manifestBooks };
  await writeFile(join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest), "utf8");
  console.log(`✓ Built BSB Scripture assets: ${manifestBooks.length} books, ${totalVerses} verses, ${searchDocuments.length} searchable verse documents`);
}
const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) buildBibleAssets({ force: process.argv.includes("--force") }).catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exitCode = 1; });
