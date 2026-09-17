import { assertLocalDate } from "../domain/time";
import type { LocalDate } from "../domain/types";
export function validateCompletedThroughDate(value: string, today: LocalDate): asserts value is LocalDate {
  assertLocalDate(value);
  if (value < `${today.slice(0, 4)}-01-01` || value > today) throw new Error("Choose a completed-through date from this year, no later than today.");
}
