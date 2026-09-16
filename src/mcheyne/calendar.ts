import type { LocalDate } from "../domain/types";
import type { McheyneAssignment, McheynePlan } from "./types";

export function calendarKeyFromLocalDate(localDate: LocalDate): string {
  return localDate.slice(5);
}

export function calendarYear(localDate: LocalDate): number {
  return Number(localDate.slice(0, 4));
}

export function assignmentForCalendarDate(plan: McheynePlan, localDate: LocalDate): McheyneAssignment | null {
  const key = calendarKeyFromLocalDate(localDate);
  return plan.assignments.find((assignment) => assignment.calendarKey === key) ?? null;
}

export function sequenceOnOrAfter(plan: McheynePlan, localDate: LocalDate): number | null {
  const key = calendarKeyFromLocalDate(localDate);
  return plan.assignments.find((assignment) => assignment.calendarKey >= key)?.sequence ?? null;
}

export function sequenceOnOrBefore(plan: McheynePlan, localDate: LocalDate): number | null {
  const key = calendarKeyFromLocalDate(localDate);
  const matches = plan.assignments.filter((assignment) => assignment.calendarKey <= key);
  return matches.at(-1)?.sequence ?? null;
}

export function localDateForCalendarKey(year: number, calendarKey: string): LocalDate {
  return `${year.toString().padStart(4, "0")}-${calendarKey}` as LocalDate;
}

export function monthForCalendarKey(calendarKey: string): number {
  return Number(calendarKey.slice(0, 2));
}
