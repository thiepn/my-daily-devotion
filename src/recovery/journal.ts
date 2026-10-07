import type { MddDatabase } from "../data/database";
import type { DraftJournalState } from "./types";

export function newJournalState(): DraftJournalState {
  return { key: "journal", formatVersion: 1, epoch: crypto.randomUUID() };
}
export async function readJournalEpoch(database: MddDatabase): Promise<string> {
  const state = await database.draftJournalState.get("journal");
  if (!state || state.formatVersion !== 1 || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(state.epoch)) {
    throw new Error("Recovery journal metadata is unavailable. Saved data has not been cleared.");
  }
  return state.epoch;
}
