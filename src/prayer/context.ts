import type { ScriptureReference } from "../domain/types";
import { todayLocalDate } from "../domain/time";

export function buildPrayerFromScriptureUrl(reference: ScriptureReference, returnTo?: string): string {
  const params = new URLSearchParams({
    translation: reference.translationId,
    start: reference.startVerseKey,
    end: reference.endVerseKey,
    sourceDevotionDate: todayLocalDate(),
  });
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) params.set("return", returnTo);
  return `/prayer/new?${params.toString()}`;
}
