import type { ScriptureReference } from "../domain/types";
import { safeDataReturn } from "../data/data-context";

export const SEARCH_SCOPES = ["all", "scripture", "prayers", "reflections", "people", "saved"] as const;
export type SearchScope = typeof SEARCH_SCOPES[number];
export const SEARCH_LABELS: Record<SearchScope, string> = { all: "All", scripture: "Scripture", prayers: "Prayers", reflections: "Reflections", people: "People", saved: "Saved Scripture" };
export function shownCount(value: string | null, initial: number, step = 20) {
  const count = value && /^\d+$/.test(value) ? Number(value) : initial;
  const rounded = initial + Math.ceil((count - initial) / step) * step;
  return count >= initial && Number.isSafeInteger(rounded) ? rounded : initial;
}
export function parseSearchQuery(search: string) {
  const params = new URLSearchParams(search);
  const scope = SEARCH_SCOPES.find(value => value === params.get("scope")) ?? "all";
  const q = (params.get("q") ?? "").trim();
  const notes = params.get("notes") === "1";
  const initial = scope === "all" ? 10 : 20;
  const shown = Object.fromEntries(SEARCH_SCOPES.filter(value => value !== "all").map(key => [key, shownCount(params.get(`${key}Shown`), initial)])) as Record<Exclude<SearchScope, "all">, number>;
  const book = params.get("book")?.match(/^[A-Z0-9]{3}$/)?.[0] ?? "";
  const testament: "OT" | "NT" | null = params.get("testament") === "OT" ? "OT" : params.get("testament") === "NT" ? "NT" : null;
  const returnTo = safeDataReturn(params.get("return"));
  const normalized = new URLSearchParams();
  if (q) normalized.set("q", q);
  if (scope !== "all") normalized.set("scope", scope);
  if (notes) normalized.set("notes", "1");
  if (book) normalized.set("book", book);
  if (testament) normalized.set("testament", testament);
  for (const key of SEARCH_SCOPES) if (key !== "all" && shown[key] !== initial) normalized.set(`${key}Shown`, String(shown[key]));
  if (params.has("return") && returnTo === params.get("return")) normalized.set("return", returnTo);
  return { q, scope, notes, shown, book, testament, returnTo, search: normalized.size ? `?${normalized}` : "" };
}
export function withSearchReturn(href: string, returnTo: string) {
  const [path, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set("return", safeDataReturn(returnTo));
  return `${path}?${params}`;
}
/** Full identity remains in the URL, even when a saved range crosses chapters. */
export function savedPassageUrl(reference: ScriptureReference, returnTo?: string) {
  const [book, chapter, verse] = reference.startVerseKey.split(".");
  const [endBook, endChapter, endVerse] = reference.endVerseKey.split(".");
  const params = new URLSearchParams({ translation: reference.translationId, start: reference.startVerseKey, end: reference.endVerseKey, verse: verse! });
  if (book === endBook && chapter === endChapter) params.set("endVerse", endVerse!);
  if (returnTo) params.set("return", safeDataReturn(returnTo));
  return `/bible/${book}/${chapter}?${params}`;
}
