import type { BibleChapterAsset } from "./types";

/** Preserve block and verse boundaries; inline spans within a verse concatenate. */
export function scriptureTextForRange(chapter: BibleChapterAsset, first: number, last = first): string {
  const start = Math.min(first, last), end = Math.max(first, last);
  return chapter.blocks.map((block) => {
    let previous: string | null = null;
    let text = "";
    for (const segment of block.segments) {
      if (segment.verse === null || segment.verse < start || segment.verse > end) continue;
      if (previous !== null && previous !== segment.verseKey) text += " ";
      text += segment.text;
      previous = segment.verseKey;
    }
    return text;
  }).filter((text) => text.trim()).join(" ").replace(/\s+/g, " ").trim();
}
