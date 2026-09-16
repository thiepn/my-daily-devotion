import type { VerseKey } from "../domain/types";

export type ScriptureBlockKind = "paragraph" | "poetry" | "heading" | "superscription" | "blank";

export interface ScriptureSegment {
  verseKey: VerseKey | null;
  verse: number | null;
  text: string;
  isVerseStart: boolean;
  redLetter: boolean;
  emphasis: string | null;
}

export interface ScriptureNote {
  verseKey: VerseKey | null;
  marker: string;
  text: string;
}

export interface ScriptureBlock {
  kind: ScriptureBlockKind;
  marker: string;
  level: number;
  segments: ScriptureSegment[];
}

export interface BibleChapterAsset {
  chapter: number;
  blocks: ScriptureBlock[];
  notes: ScriptureNote[];
  verseCount: number;
}

export interface BibleBookAsset {
  schemaVersion: number;
  translationId: "BSB";
  bookId: string;
  name: string;
  testament: "OT" | "NT";
  order: number;
  chapterCount: number;
  chapters: BibleChapterAsset[];
}

export interface BibleManifestBook {
  order: number;
  id: string;
  name: string;
  testament: "OT" | "NT";
  chapterCount: number;
  path: string;
}

export interface BibleManifest {
  schemaVersion: number;
  translationId: "BSB";
  name: string;
  editionLabel: string;
  parserVersion: string;
  normalizedDataVersion: number;
  generatedAt: string;
  source: {
    canonicalDownload: string;
    downloadedFrom: string;
    release: string;
    sha256: string;
    format: "USJ";
  };
  totalVerses: number;
  books: BibleManifestBook[];
}
