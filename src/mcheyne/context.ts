import type { PlanEnrollment } from "../domain/types";
import { parseVerseKey } from "../scripture/repository";
import type { McheynePlan, McheyneReading } from "./types";

export type PlanOrigin = "today" | "plan";

export interface PlanReadingLocator {
  enrollmentId: string;
  sequence: number;
  readingIndex: number;
  segmentIndex: number;
  origin: PlanOrigin;
}

export interface ResolvedPlanReadingContext extends PlanReadingLocator {
  enrollment: PlanEnrollment;
  reading: McheyneReading;
}

export function buildPlanReadingUrl(
  reading: McheyneReading,
  enrollmentId: string,
  sequence: number,
  readingIndex: number,
  origin: PlanOrigin,
  segmentIndex = 0,
): string {
  const segment = reading.references[segmentIndex] ?? reading.references[0];
  if (!segment) throw new Error("M'Cheyne reading has no Scripture range.");
  const start = parseVerseKey(segment.startVerseKey);
  const query = new URLSearchParams({
    enrollment: enrollmentId,
    sequence: String(sequence),
    reading: String(readingIndex),
    segment: String(segmentIndex),
    origin,
  });
  return `/bible/${start.bookId}/${start.chapter}?${query.toString()}`;
}

export function parsePlanReadingLocator(search: URLSearchParams): PlanReadingLocator | null {
  const enrollmentId = search.get("enrollment");
  const sequence = Number(search.get("sequence"));
  const readingIndex = Number(search.get("reading"));
  const segmentIndex = Number(search.get("segment") ?? "0");
  const origin = search.get("origin");
  if (!enrollmentId || !Number.isInteger(sequence) || sequence < 1 || sequence > 365) return null;
  if (!Number.isInteger(readingIndex) || readingIndex < 0 || readingIndex > 3) return null;
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) return null;
  if (origin !== "today" && origin !== "plan") return null;
  return { enrollmentId, sequence, readingIndex, segmentIndex, origin };
}

export function resolveReading(plan: McheynePlan, locator: PlanReadingLocator): McheyneReading | null {
  return plan.assignments.find((assignment) => assignment.sequence === locator.sequence)?.readings[locator.readingIndex] ?? null;
}

export function chapterWithinReference(bookId: string, chapter: number, reading: McheyneReading, segmentIndex: number): boolean {
  const reference = reading.references[segmentIndex];
  if (!reference) return false;
  const start = parseVerseKey(reference.startVerseKey);
  const end = parseVerseKey(reference.endVerseKey);
  return start.bookId === bookId && end.bookId === bookId && chapter >= Math.min(start.chapter, end.chapter) && chapter <= Math.max(start.chapter, end.chapter);
}

export function appendPlanQuery(path: string, locator: PlanReadingLocator): string {
  const query = new URLSearchParams({
    enrollment: locator.enrollmentId,
    sequence: String(locator.sequence),
    reading: String(locator.readingIndex),
    segment: String(locator.segmentIndex),
    origin: locator.origin,
  });
  return `${path}?${query.toString()}`;
}
