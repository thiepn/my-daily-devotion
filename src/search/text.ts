/** Map normalized characters back to the original text, including composed accents. */
export function normalizeSearch(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/[’]/g, "'").replace(/[“”]/g, '"');
}
export function searchText(value: string) {
  let normalized = "";
  const offsets: number[] = [];
  let offset = 0;
  for (const char of value) {
    const folded = normalizeSearch(char);
    for (const unit of folded) { normalized += unit; offsets.push(offset); }
    offset += char.length;
  }
  offsets.push(value.length);
  return { normalized, offsets };
}
export function matchingRanges(value: string, query: string): Array<[number, number]> {
  const text = searchText(value), needle = searchText(query.trim().replace(/^"|"$/g, "")).normalized;
  if (!needle) return [];
  const phrases = text.normalized.includes(needle) ? [needle] : needle.split(/\s+/).filter(Boolean);
  const ranges: Array<[number, number]> = [];
  for (const phrase of phrases) {
    let at = text.normalized.indexOf(phrase);
    while (at >= 0) {
      ranges.push([text.offsets[at]!, text.offsets[at + phrase.length]!]);
      at = text.normalized.indexOf(phrase, at + phrase.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges.reduce<Array<[number, number]>>((result, range) => {
    const previous = result.at(-1);
    if (previous && previous[1] >= range[0]) previous[1] = Math.max(previous[1], range[1]);
    else result.push(range);
    return result;
  }, []);
}
export function matchExcerpt(value: string, query: string, limit = 180): string {
  const clean = value.replace(/[#>*_`\[\]()~]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const match = matchingRanges(clean, query)[0];
  let start = Math.max(0, (match?.[0] ?? 0) - Math.floor(limit / 3));
  if (start > 0) { const space = clean.indexOf(" ", start); if (space < start + 20 && space >= 0) start = space + 1; }
  return `${start ? "…" : ""}${clean.slice(start, start + limit).trim()}${start + limit < clean.length ? "…" : ""}`;
}
