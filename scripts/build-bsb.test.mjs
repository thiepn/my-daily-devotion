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
