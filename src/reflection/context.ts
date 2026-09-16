import type { LocalDate, Reflection, ScriptureReference, VerseKey } from "../domain/types";

const VERSE_KEY = /^[1-3]?[A-Z]{2,3}\.[1-9][0-9]*\.[1-9][0-9]*$/;

export function buildReflectionUrl(localDate: LocalDate, reference?: ScriptureReference | null, returnTo?: string): string {
  const params = new URLSearchParams();
  if (reference) {
    params.set("translation", reference.translationId);
    params.set("start", reference.startVerseKey);
    params.set("end", reference.endVerseKey);
  }
  if (returnTo?.startsWith("/")) params.set("return", returnTo);
  const query = params.toString();
  return `/today/reflection/${localDate}${query ? `?${query}` : ""}`;
}

export function parsePendingScripture(params: URLSearchParams): ScriptureReference | null {
  const translationId = params.get("translation") ?? "BSB";
  const start = params.get("start");
  const end = params.get("end");
  if (!start || !end || !VERSE_KEY.test(start) || !VERSE_KEY.test(end)) return null;
  return { translationId, startVerseKey: start as VerseKey, endVerseKey: end as VerseKey };
}

export function buildPrayerHandoffUrl(reflection: Reflection): string {
  const params = new URLSearchParams({ sourceReflectionId: reflection.id, sourceDevotionDate: reflection.localDate });
  return `/prayer/new?${params.toString()}`;
}
