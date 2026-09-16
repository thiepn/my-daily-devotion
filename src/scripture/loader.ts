import type { BibleBookAsset, BibleChapterAsset, BibleManifest, BibleSearchDocument } from "./types";

const bibleBase = `${import.meta.env.BASE_URL}bible`;
let manifestPromise: Promise<BibleManifest> | null = null;
let searchPromise: Promise<BibleSearchDocument[]> | null = null;
const bookPromises = new Map<string, Promise<BibleBookAsset>>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not load Scripture asset (${response.status}).`);
  return response.json() as Promise<T>;
}

export function loadBibleManifest(): Promise<BibleManifest> {
  manifestPromise ??= fetchJson<BibleManifest>(`${bibleBase}/manifest.json`);
  return manifestPromise;
}

export async function loadBibleSearchIndex(): Promise<BibleSearchDocument[]> {
  if (searchPromise) return searchPromise;
  const manifest = await loadBibleManifest();
  searchPromise = fetchJson<BibleSearchDocument[]>(`${import.meta.env.BASE_URL}${manifest.searchIndexPath.replace(/^\//, "")}`).catch((error) => { searchPromise = null; throw error; });
  return searchPromise;
}

export async function loadBibleBook(bookId: string): Promise<BibleBookAsset> {
  const normalizedId = bookId.toUpperCase();
  const existing = bookPromises.get(normalizedId);
  if (existing) return existing;
  const manifest = await loadBibleManifest();
  const book = manifest.books.find((item) => item.id === normalizedId);
  if (!book) throw new Error(`Unknown Bible book: ${normalizedId}`);
  const promise = fetchJson<BibleBookAsset>(`${import.meta.env.BASE_URL}${book.path.replace(/^\//, "")}`).then((asset) => {
    if (asset.bookId !== normalizedId || asset.translationId !== "BSB") throw new Error(`Scripture asset identity mismatch for ${normalizedId}.`);
    return asset;
  }).catch((error) => { bookPromises.delete(normalizedId); throw error; });
  bookPromises.set(normalizedId, promise);
  return promise;
}

export async function loadBibleChapter(bookId: string, chapter: number): Promise<BibleChapterAsset> {
  const book = await loadBibleBook(bookId);
  const result = book.chapters.find((item) => item.chapter === chapter);
  if (!result) throw new Error(`${book.name} ${chapter} is not available.`);
  return result;
}
