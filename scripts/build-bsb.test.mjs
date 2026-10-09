import { describe, expect, it } from "vitest";
import { normalizeUsjBook, searchDocumentsForBook } from "./build-bsb.mjs";

const book = (blocks) => normalizeUsjBook({ type: "USJ", content: [
  { type: "book", code: "PSA" }, { type: "chapter", number: "1" }, ...blocks,
]}, { id: "PSA", name: "Psalms", testament: "OT", order: 19 });
const verse = { type: "verse", number: "1", sid: "PSA 1:1" };

describe("Scripture word boundaries", () => {
  it("separates poetry lines in searchable text without changing their wording", () => {
    const normalized = book([
      { marker: "q1", content: [verse, "Wait patiently for the LORD;"] },
      { marker: "q2", content: ["be strong and courageous."] },
      { marker: "q1", content: ["Wait patiently for the LORD!"] },
    ]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("Wait patiently for the LORD; be strong and courageous. Wait patiently for the LORD!");
  });
  it("keeps adjacent added words separate in the reader and search", () => {
    const normalized = book([{ marker: "p", content: [verse, "The Lord is not slow ",
      { marker: "add", content: ["in keeping"] }, { marker: "add", content: ["His"] }, " promise.",
    ] }]);
    expect(normalized.chapters[0].blocks[0].segments.map(s => s.text).join("")).toBe("The Lord is not slow in keeping His promise.");
    expect(searchDocumentsForBook(normalized)[0].text).toBe("The Lord is not slow in keeping His promise.");
  });
  it("preserves punctuation and inline emphasis within a paragraph", () => {
    const normalized = book([{ marker: "p", content: [verse, "The ", { marker: "nd", content: ["LORD"] }, ", our God."] }]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("The LORD, our God.");
  });
});

describe("corrective Scripture normalization", () => {
  it("separates a word from an added word after an omitted footnote", () => {
    const normalized = book([{ marker: "p", content: [verse, "Then Jesus called the Twelve",
      { type: "note", marker: "f", content: ["TR His twelve disciples"] },
      { type: "char", marker: "add", content: ["together"] },
      { type: "char", marker: "add", content: ["and"] }, " gave them power.",
    ] }]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("Then Jesus called the Twelve together and gave them power.");
    expect(normalized.chapters[0].notes).toHaveLength(1);
  });
  it("separates words across notes without detaching punctuation or duplicating existing spaces", () => {
    const note = { type: "note", marker: "f", content: ["A source note"] };
    const normalized = book([{ marker: "p", content: [verse, "one", note, "another", note, ", and ", note, "obey?", note, "Yes."] }]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("one another, and obey? Yes.");
  });
  it("separates red-letter quotation exits from added narration", () => {
    const normalized = book([{ marker: "p", content: [verse, { marker: "wj", content: ["“Come, follow Me,”"] }, { marker: "add", content: ["Jesus"] }, " said."] }]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("“Come, follow Me,” Jesus said.");
  });
  it("preserves the word boundary after an omitted note", () => {
    const normalized = book([{ marker: "p", content: [verse, "“Do not sin.”", { type: "note", marker: "f", content: ["A source note"] }, "Do not let the sun go down."] }]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("“Do not sin.” Do not let the sun go down.");
    expect(normalized.chapters[0].notes).toHaveLength(1);
  });
  it("does not split words or detach punctuation at emphasis boundaries", () => {
    const normalized = book([{ marker: "p", content: [verse, "be", { marker: "it", content: ["lieve"] }, ", and obey."] }]);
    expect(searchDocumentsForBook(normalized)[0].text).toBe("believe, and obey.");
  });
});
