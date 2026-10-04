export const DATA_SECTIONS = ["backups", "restore", "appearance", "privacy", "advanced"] as const;
export type DataSection = typeof DATA_SECTIONS[number];
export function safeDataReturn(value: string | null): string {
  if (!value || !/^\/(today|bible|prayer|history|search|welcome)(?:[/?#]|$)/.test(value) || /[\\\x00-\x1f]/.test(value)) return "/today";
  return value;
}
export function parseDataContext(search: string) {
  const input = new URLSearchParams(search), normalized = new URLSearchParams();
  const section = DATA_SECTIONS.find(value => value === input.get("section")) ?? null;
  const returnTo = safeDataReturn(input.get("return"));
  if (section) normalized.set("section", section);
  if (input.has("return") && returnTo === input.get("return")) normalized.set("return", returnTo);
  return { section, returnTo, search: normalized.size ? `?${normalized}` : "" };
}

export const BACKUP_TABLE_LABELS: Record<string, string> = {
  devotionDays: "Devotional days", reflections: "Reflections", highlights: "Highlights", bookmarks: "Bookmarks", verseNotes: "Verse notes",
  collections: "Collections", collectionItems: "Collected passages", scriptureLinks: "Scripture links", planEnrollments: "Reading plans", readingProgress: "Reading records",
  readerPositions: "Reader positions", prayers: "Prayers", prayerUpdates: "Prayer updates", prayerResolutions: "Prayer answers", prayerSchedules: "Prayer schedules",
  prayerSessions: "Prayer sessions", prayerSessionItems: "Session requests", people: "People", categories: "Categories", activityEvents: "History events", preferences: "Preferences",
};
