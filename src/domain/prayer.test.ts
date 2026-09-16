import { describe, expect, it } from "vitest";
import { assertPrayerTransition, canTransitionPrayer } from "./prayer";

describe("prayer lifecycle", () => {
  it("allows only Phase 0 transitions", () => {
    expect(canTransitionPrayer("ACTIVE", "WAITING")).toBe(true);
    expect(canTransitionPrayer("WAITING", "ACTIVE")).toBe(true);
    expect(canTransitionPrayer("ACTIVE", "ANSWERED")).toBe(true);
    expect(canTransitionPrayer("ANSWERED", "ARCHIVED")).toBe(true);
  });

  it("rejects reopening answered or archived prayers implicitly", () => {
    expect(canTransitionPrayer("ANSWERED", "ACTIVE")).toBe(false);
    expect(() => assertPrayerTransition("ARCHIVED", "ACTIVE")).toThrow("Illegal prayer lifecycle transition");
  });
});
