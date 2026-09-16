import type { ScriptureReference } from "../domain/types";

export function buildPrayerFromScriptureUrl(reference: ScriptureReference, returnTo?: string): string {
  const params = new URLSearchParams({
    translation: reference.translationId,
    start: reference.startVerseKey,
    end: reference.endVerseKey,
  });
  if (returnTo?.startsWith("/")) params.set("return", returnTo);
  return `/prayer/new?${params.toString()}`;
}
