import type { MddDatabase } from "./database";
import type { ReadingProgress } from "../domain/types";
import { nowInstant } from "../domain/identity";

/** Schema-1 data repair: retain every source row and all history. No text is removed. */
export async function repairDuplicateReadingProgress(database: MddDatabase): Promise<number> {
  return database.transaction("rw", database.readingProgress, database.preferences, async () => {
    const rows = await database.readingProgress.filter((row) => row.deletedAt === null).toArray();
    const groups = new Map<string, ReadingProgress[]>();
    for (const row of rows) {
      const key = `${row.planEnrollmentId}|${row.assignmentSequence}|${row.readingIndex}`;
      const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
    }
    const at = nowInstant();
    const repaired: Array<{ winnerId: string; retiredIds: string[] }> = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      // Preserve the most recently edited state, including an explicit unread.
      // Stable ID is only a deterministic tie-break, never a substitute for time.
      group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.revision - a.revision || a.id.localeCompare(b.id));
      const [winner, ...duplicates] = group;
      for (const row of duplicates) await database.readingProgress.put({ ...row, deletedAt: at, updatedAt: at, revision: row.revision + 1 });
      repaired.push({ winnerId: winner!.id, retiredIds: duplicates.map((row) => row.id) });
    }
    if (repaired.length) await database.preferences.put({ key: `mdd.repair.readingProgress.${crypto.randomUUID()}`, value: { repairedAt: at, groups: repaired }, updatedAt: at });
    return repaired.reduce((sum, group) => sum + group.retiredIds.length, 0);
  });
}
