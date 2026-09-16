import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BibleManifest, BibleSearchDocument } from "./types";

const manifest: BibleManifest = {
  schemaVersion: 1,
  translationId: "BSB",
  name: "Berean Standard Bible",
  editionLabel: "test",
  parserVersion: "test",
  normalizedDataVersion: 1,
  generatedAt: "2026-09-17T00:00:00.000Z",
  searchIndexPath: "/bible/search-index.json",
  source: { canonicalDownload: "test", downloadedFrom: "test", release: "test", sha256: "test", format: "USJ" },
  totalVerses: 4,
  books: [
    { order: 1, id: "GEN", name: "Genesis", testament: "OT", chapterCount: 50, path: "/bible/books/GEN.json" },
    { order: 43, id: "JHN", name: "John", testament: "NT", chapterCount: 21, path: "/bible/books/JHN.json" },
    { order: 45, id: "ROM", name: "Romans", testament: "NT", chapterCount: 16, path: "/bible/books/ROM.json" },
  ],
};

const documents: BibleSearchDocument[] = [
  { verseKey: "GEN.1.1", bookId: "GEN", bookName: "Genesis", testament: "OT", order: 1, chapter: 1, verse: 1, text: "In the beginning God created the heavens and the earth." },
  { verseKey: "JHN.3.16", bookId: "JHN", bookName: "John", testament: "NT", order: 43, chapter: 3, verse: 16, text: "For God so loved the world that He gave His one and only Son." },
  { verseKey: "JHN.3.17", bookId: "JHN", bookName: "John", testament: "NT", order: 43, chapter: 3, verse: 17, text: "For God did not send His Son into the world to condemn the world." },
  { verseKey: "ROM.10.17", bookId: "ROM", bookName: "Romans", testament: "NT", order: 45, chapter: 10, verse: 17, text: "Consequently, faith comes by hearing, and hearing by the word of Christ." },
];

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const body = url.endsWith("manifest.json") ? manifest : url.endsWith("search-index.json") ? documents : null;
    return {
      ok: body !== null,
      status: body === null ? 404 : 200,
      json: async () => body,
    } as Response;
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe("Bible search", () => {
  it("resolves canonical book references and verse ranges", async () => {
    const { searchBible } = await import("./search");
    expect((await searchBible("John 3:16")).map((item) => item.verseKey)).toEqual(["JHN.3.16"]);
    expect((await searchBible("John 3:16-17")).map((item) => item.verseKey)).toEqual(["JHN.3.16", "JHN.3.17"]);
  });

  it("matches an exact quoted phrase", async () => {
    const { searchBible } = await import("./search");
    const results = await searchBible('"God so loved"');
    expect(results).toHaveLength(1);
    expect(results[0]?.verseKey).toBe("JHN.3.16");
  });

  it("requires every word in a multiword query", async () => {
    const { searchBible } = await import("./search");
    const results = await searchBible("faith hearing");
    expect(results.map((item) => item.verseKey)).toEqual(["ROM.10.17"]);
  });

  it("applies book and testament filters", async () => {
    const { searchBible } = await import("./search");
    expect((await searchBible("God", { bookId: "JHN" })).map((item) => item.verseKey)).toEqual(["JHN.3.16", "JHN.3.17"]);
    expect((await searchBible("God", { testament: "OT" })).map((item) => item.verseKey)).toEqual(["GEN.1.1"]);
  });

  it("uses stable canonical order to break equal scores", async () => {
    const { searchBible } = await import("./search");
    expect((await searchBible("God")).map((item) => item.verseKey)).toEqual(["GEN.1.1", "JHN.3.16", "JHN.3.17"]);
  });
});
