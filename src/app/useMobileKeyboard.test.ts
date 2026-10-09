import { describe, expect, it } from "vitest";
import { keyboardOccludesEditor } from "./useMobileKeyboard";

const base = { compact: true, editing: true, fullHeight: 844, visibleHeight: 545, scale: 1 };
describe("mobile keyboard viewport classification", () => {
  it("hides fixed tab chrome only for an editor obscured by a smaller viewport", () => {
    expect(keyboardOccludesEditor(base)).toBe(true);
    expect(keyboardOccludesEditor({ ...base, visibleHeight: 704 })).toBe(true);
    expect(keyboardOccludesEditor({ ...base, visibleHeight: 705 })).toBe(false);
  });
  it("does not hide navigation on focus alone, desktop, pinch zoom or invalid geometry", () => {
    for (const value of [
      { editing: false }, { compact: false }, { scale: 1.5 }, { fullHeight: Number.NaN },
      { visibleHeight: 844 }, { visibleHeight: 824 },
    ]) {
      expect(keyboardOccludesEditor({ ...base, ...value })).toBe(false);
    }
  });
});
