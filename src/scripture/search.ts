import type { VerseKey } from "../domain/types";
import { loadBibleManifest, loadBibleSearchIndex } from "./loader";
import type { BibleSearchDocument } from "./types";

export interface BibleSearchOptions {
  bookId?: string | null;
  testament?: "OT" | "NT" | null;
  limit?: number;
  offset?: number;
}

export interface BibleSearchResult extends BibleSearchDocument { score: number; }

function normalized(value: string): string { return value.toLocaleLowerCase().normalize("NFKD").replace(/[“”]/g, '"').replace(/[’]/g, "'"); }

async function parseReference(query: string): Promise<{ bookId: string; chapter: number; startVerse: number | null; endVerse: number | null } | null> {
  const match = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/.exec(query.trim());
  if (!match) return null;
  const manifest = await loadBibleManifest();
  const bookText = normalized(match[1]! ).replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = { jn: "JHN", john: "JHN", ps: "PSA", psalm: "PSA", prov: "PRO", gen: "GEN", rev: "REV", matt: "MAT", mk: "MRK", lk: "LUK", rom: "ROM" };
  const book = manifest.books.find((item) => item.id === aliases[bookText.replace(/\.$/, "")] || normalized(item.name) === bookText || normalized(item.id) === bookText.replace(/\s+/g, ""));
  if (!book) return null;
  const chapter = Number(match[2]);
  const startVerse = match[3] ? Number(match[3]) : null;
  const endVerse = match[4] ? Number(match[4]) : startVerse;
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapterCount) return null;
  return { bookId: book.id, chapter, startVerse, endVerse };
}

export async function searchBiblePage(rawQuery: string, options: BibleSearchOptions = {}): Promise<{ items: BibleSearchResult[]; total: number }> {
  const query = rawQuery.trim();
  if (!query) return { items: [], total: 0 };
  const documents = await loadBibleSearchIndex();
  const limit = Number.isSafeInteger(options.limit) && options.limit! > 0 ? options.limit! : 40;
  const offset = Number.isSafeInteger(options.offset) && options.offset! >= 0 ? options.offset! : 0;
  const page = (items: BibleSearchResult[]) => ({ items: items.slice(offset, offset + limit), total: items.length });
  const reference = await parseReference(query);
  const filtered = documents.filter((doc) => (!options.bookId || doc.bookId === options.bookId) && (!options.testament || doc.testament === options.testament));

  if (reference) {
    return page(filtered
      .filter((doc) => doc.bookId === reference.bookId && doc.chapter === reference.chapter && (reference.startVerse === null || (doc.verse >= reference.startVerse && doc.verse <= (reference.endVerse ?? reference.startVerse))))
      .map((doc) => ({ ...doc, score: 10_000 - doc.verse })));
  }

  const q = normalized(query);
  const quoted = q.length >= 2 && q.startsWith('"') && q.endsWith('"') ? q.slice(1, -1).trim() : null;
  const tokens = (quoted ?? q).split(/\s+/).filter(Boolean);
  if (!tokens.length) return { items: [], total: 0 };

  const results: BibleSearchResult[] = [];
  for (const doc of filtered) {
    const text = normalized(doc.text);
    if (quoted) {
      const index = text.indexOf(quoted);
      if (index < 0) continue;
      results.push({ ...doc, score: 2000 - Math.min(index, 1000) });
      continue;
    }
    if (!tokens.every((token) => text.includes(token))) continue;
    let score = text.includes(q) ? 1000 : 0;
    for (const token of tokens) {
      let index = text.indexOf(token);
      while (index >= 0) { score += 20; index = text.indexOf(token, index + token.length); }
    }
    results.push({ ...doc, score });
  }
  return page(results.sort((a, b) => b.score - a.score || a.order - b.order || a.chapter - b.chapter || a.verse - b.verse));
}

export async function searchBible(rawQuery: string, options: BibleSearchOptions = {}): Promise<BibleSearchResult[]> {
  return (await searchBiblePage(rawQuery, options)).items;
}

export function bibleSearchHref(result: BibleSearchDocument): string { return `/bible/${result.bookId}/${result.chapter}?verse=${result.verse}`; }
export function verseKeyForSearch(result: BibleSearchDocument): VerseKey { return result.verseKey; }
