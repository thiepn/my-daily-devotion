import { describe, expect, it } from "vitest";
import type { LocalDate } from "../domain/types";
import { assignmentForCalendarDate, sequenceOnOrAfter, sequenceOnOrBefore } from "./calendar";
import { buildPlanReadingUrl, parsePlanReadingLocator } from "./context";
import type { McheyneAssignment, McheynePlan, McheyneReading } from "./types";

const reading: McheyneReading = {
  group: "family",
  displayReference: "Genesis 1",
  references: [{ translationId: "BSB", startVerseKey: "GEN.1.1", endVerseKey: "GEN.1.31" }],
};

function assignment(sequence: number, calendarKey: string): McheyneAssignment {
  return { sequence, calendarKey, readings: [reading, reading, { ...reading, group: "secret" }, { ...reading, group: "secret" }] };
}

const plan = {
  planId: "mcheyne-classic",
  version: 1,
  assignments: [assignment(1, "01-01"), assignment(59, "02-28"), assignment(60, "03-01"), assignment(259, "09-16"), assignment(365, "12-31")],
} as McheynePlan;

describe("M'Cheyne calendar mapping", () => {
  it("does not create or shift a February 29 assignment", () => {
    expect(assignmentForCalendarDate(plan, "2028-02-29" as LocalDate)).toBeNull();
    expect(sequenceOnOrBefore(plan, "2028-02-29" as LocalDate)).toBe(59);
    expect(sequenceOnOrAfter(plan, "2028-02-29" as LocalDate)).toBe(60);
    expect(assignmentForCalendarDate(plan, "2028-03-01" as LocalDate)?.sequence).toBe(60);
  });

  it("maps fixed-date anchors independent of year", () => {
    expect(assignmentForCalendarDate(plan, "2026-01-01" as LocalDate)?.sequence).toBe(1);
    expect(assignmentForCalendarDate(plan, "2032-09-16" as LocalDate)?.sequence).toBe(259);
    expect(assignmentForCalendarDate(plan, "2026-12-31" as LocalDate)?.sequence).toBe(365);
  });
});

describe("M'Cheyne reader context", () => {
  it("builds and parses a structural plan-reading URL", () => {
    const url = buildPlanReadingUrl(reading, "enrollment-1", 1, 0, "today");
    expect(url).toContain("/bible/GEN/1?");
    const query = new URLSearchParams(url.split("?")[1]);
    expect(parsePlanReadingLocator(query)).toEqual({
      enrollmentId: "enrollment-1",
      sequence: 1,
      readingIndex: 0,
      segmentIndex: 0,
      origin: "today",
    });
  });
});
