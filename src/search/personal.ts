import type { MddDatabase } from "../data/database";

export interface PersonalSearchHit {
  id: string;
  title: string;
  excerpt: string;
  href: string;
  kind: string;
  updatedAt: string;
}

export interface PersonalSearchResults {
  prayers: PersonalSearchHit[];
  reflections: PersonalSearchHit[];
  people: PersonalSearchHit[];
  saved: PersonalSearchHit[];
}

function normalize(value: string): string { return value.toLocaleLowerCase().normalize("NFKD"); }
function matches(value: string | null | undefined, query: string): boolean { return Boolean(value && normalize(value).includes(query)); }
function excerpt(value: string, limit = 180): string {
  const clean = value.replace(/[#>*_`\[\]()~-]/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}
function newest(a: PersonalSearchHit, b: PersonalSearchHit): number { return b.updatedAt.localeCompare(a.updatedAt); }

export async function searchPersonal(database: MddDatabase, rawQuery: string, limitPerGroup = 12): Promise<PersonalSearchResults> {
  const query = normalize(rawQuery.trim());
  if (!query) return { prayers: [], reflections: [], people: [], saved: [] };

  const [prayers, updates, resolutions, reflections, people, notes, collections, collectionItems] = await Promise.all([
    database.prayers.filter((item) => item.deletedAt === null).toArray(),
    database.prayerUpdates.filter((item) => item.deletedAt === null).toArray(),
    database.prayerResolutions.filter((item) => item.deletedAt === null).toArray(),
    database.reflections.filter((item) => item.deletedAt === null).toArray(),
    database.people.filter((item) => item.deletedAt === null).toArray(),
    database.verseNotes.filter((item) => item.deletedAt === null).toArray(),
    database.collections.filter((item) => item.deletedAt === null).toArray(),
    database.collectionItems.filter((item) => item.deletedAt === null).toArray(),
  ]);

  const prayerMap = new Map(prayers.map((item) => [item.id, item]));
  const prayerHits = new Map<string, PersonalSearchHit>();
  for (const prayer of prayers) {
    if (matches(prayer.body, query)) prayerHits.set(prayer.id, { id: prayer.id, title: prayer.body, excerpt: prayer.body, href: `/prayer/${prayer.id}`, kind: `Prayer · ${prayer.status.toLowerCase()}`, updatedAt: prayer.updatedAt });
  }
  for (const update of updates) {
    if (!matches(update.body, query)) continue;
    const prayer = prayerMap.get(update.prayerId);
    if (!prayer) continue;
    prayerHits.set(`update:${update.id}`, { id: update.id, title: prayer.body, excerpt: excerpt(update.body), href: `/prayer/${prayer.id}`, kind: update.type === "encouragement" ? "Prayer encouragement" : "Prayer update", updatedAt: update.updatedAt });
  }
  for (const resolution of resolutions) {
    if (!matches(resolution.reflectionMd, query)) continue;
    const prayer = prayerMap.get(resolution.prayerId);
    if (!prayer) continue;
    prayerHits.set(`answer:${resolution.id}`, { id: resolution.id, title: prayer.body, excerpt: excerpt(resolution.reflectionMd ?? prayer.body), href: `/prayer/${prayer.id}`, kind: "Answered prayer", updatedAt: resolution.updatedAt });
  }

  const reflectionHits = reflections.filter((item) => matches(item.bodyMd, query)).map((item) => ({ id: item.id, title: `Reflection · ${item.localDate}`, excerpt: excerpt(item.bodyMd), href: `/today/reflection/${item.localDate}`, kind: "Reflection", updatedAt: item.updatedAt }));
  const peopleHits = people.filter((item) => [item.name, item.relationship, item.notes].some((value) => matches(value, query))).map((item) => ({ id: item.id, title: item.name, excerpt: excerpt([item.relationship, item.notes].filter(Boolean).join(" · ") || "Prayer person"), href: "/prayer/people", kind: "Person", updatedAt: item.updatedAt }));

  const saved: PersonalSearchHit[] = notes.filter((item) => matches(item.bodyMd, query)).map((item) => ({ id: item.id, title: `${item.startVerseKey}–${item.endVerseKey}`, excerpt: excerpt(item.bodyMd), href: `/bible/${item.startVerseKey.split(".")[0]}/${item.startVerseKey.split(".")[1]}`, kind: "Verse note", updatedAt: item.updatedAt }));
  for (const collection of collections) {
    if (matches(collection.name, query) || matches(collection.description, query)) saved.push({ id: collection.id, title: collection.name, excerpt: excerpt(collection.description ?? "Scripture collection"), href: `/bible/collections?collection=${collection.id}`, kind: "Collection", updatedAt: collection.updatedAt });
  }
  for (const item of collectionItems) {
    if (!matches(item.note, query)) continue;
    const collection = collections.find((value) => value.id === item.collectionId);
    if (!collection) continue;
    saved.push({ id: item.id, title: collection.name, excerpt: excerpt(item.note ?? ""), href: `/bible/collections?collection=${collection.id}`, kind: "Collection note", updatedAt: item.updatedAt });
  }

  return {
    prayers: [...prayerHits.values()].sort(newest).slice(0, limitPerGroup),
    reflections: reflectionHits.sort(newest).slice(0, limitPerGroup),
    people: peopleHits.sort(newest).slice(0, limitPerGroup),
    saved: saved.sort(newest).slice(0, limitPerGroup),
  };
}
