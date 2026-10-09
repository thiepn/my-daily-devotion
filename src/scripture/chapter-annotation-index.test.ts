import { describe, expect, it } from "vitest";
import { coveredVersesForChapter } from "./chapter-annotation-index";
import { rangeContainsVerse, scriptureRange } from "./repository";
import type { ScriptureReference } from "../domain/types";

describe("P7 Bible chapter annotation index", () => {
  it("matches canonical range coverage for overlap, reversed ranges and other chapters", () => {
    const refs: ScriptureReference[] = [
      scriptureRange("JHN", 3, 2, 8),
      scriptureRange("JHN", 3, 6, 12),
      scriptureRange("JHN", 3, 15, 13),
      scriptureRange("GEN", 3, 1, 25),
      { translationId: "BSB", startVerseKey: "JHN.2.24", endVerseKey: "JHN.4.4" },
      { translationId: "BSB", startVerseKey: "JHN.3.20", endVerseKey: "JHN.5.2" },
      { translationId: "BSB", startVerseKey: "ACT.3.1", endVerseKey: "JHN.3.20" },
    ];
    for (const chapter of [2, 3, 4, 5]) {
      const indexed = coveredVersesForChapter(refs, "JHN", chapter, 36);
      const expected = Array.from({ length: 36 }, (_, i) => i + 1).filter(verse =>
        refs.some(ref => rangeContainsVerse(ref, "JHN", chapter, verse)));
      expect([...indexed].sort((a, b) => a - b)).toEqual(expected);
    }
  });

  it("returns empty coverage for invalid and unrelated locations", () => {
    const input = [scriptureRange("JHN", 3, 5, 10)];
    expect(coveredVersesForChapter(input, "PSA", 119, 176).size).toBe(0);
    expect(coveredVersesForChapter(input, "JHN", 3, 0).size).toBe(0);
    expect(coveredVersesForChapter(input, "JHN", Number.NaN, 36).size).toBe(0);
  });

  it("collapses hundreds of overlapping saved ranges into bounded chapter sets", () => {
    const input = Array.from({ length: 1200 }, (_, i) =>
      scriptureRange("PSA", 119, i % 176 + 1, Math.min(176, i % 176 + 6)));
    const indexed = coveredVersesForChapter(input, "PSA", 119, 176);
    expect(indexed.size).toBe(176);
    expect([...indexed].every(verse => verse >= 1 && verse <= 176)).toBe(true);
  });
});
