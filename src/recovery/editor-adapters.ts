import type { MddDatabase } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import { PrayerRepository } from "../data/repositories/prayers";
import { administrationInputFromValue } from "../prayer/PrayerAdministrationFields";
import { saveWithDraft, type DraftSaveContext, type DraftSaveOperation } from "./commit";
import { DraftError, type DraftPayload } from "./types";

/** First adapters exercise the foundation's creation/event boundaries. The
 * editor-hook release will connect these and extend the other editor kinds. */
export function saveJournalDraft(database: MddDatabase, context: DraftSaveContext) {
  const submitted = context.snapshot.contents.payload;
  const reflections = new ReflectionRepository(database), prayers = new PrayerRepository(database);
  let operation: DraftSaveOperation;
  if (submitted.kind === "reflection") {
    operation = {
      tables: ["reflections", "devotionDays", "activityEvents", "scriptureLinks"],
      validate: async payload => {
        if (payload.kind !== "reflection") throw new DraftError("invalid", "Wrong editor kind.");
        const current = await reflections.getDaily(payload.localDate);
        if (payload.baseline && (!current || current.id !== payload.baseline.id || current.revision !== payload.baseline.revision)) throw new DraftError("stale", "The reflection changed or was removed. Review both versions.");
        if (!payload.baseline && await database.reflections.where("localDate").equals(payload.localDate).count()) throw new DraftError("stale", "A reflection already exists for this date. Review before saving.");
      },
      save: async payload => {
        if (payload.kind !== "reflection") throw new DraftError("invalid", "Wrong editor kind.");
        const saved = await reflections.saveDaily(payload.localDate, payload.bodyMd, payload.baseline?.revision ?? null);
        if (!payload.dismissedReferences) for (const reference of payload.pendingReferences) await reflections.attachScripture(saved.reflection.id, reference);
        return { records: [{ id: saved.reflection.id, revision: saved.reflection.revision }], disposition: "editable" };
      },
      rebase: (newer, records) => {
        if (newer.kind !== "reflection") throw new DraftError("invalid", "Wrong editor kind.");
        // Keep references added after the submitted generation.
        const pendingReferences = submitted.dismissedReferences ? newer.pendingReferences : newer.pendingReferences.filter(reference => !submitted.pendingReferences.some(saved => JSON.stringify(saved) === JSON.stringify(reference)));
        return { ...newer, baseline: { ...records[0]!, bodyMd: submitted.bodyMd.replace(/\r\n/g, "\n").trimEnd() }, pendingReferences };
      },
    };
  } else if (submitted.kind === "prayer-create" || submitted.kind === "prayer-update" || submitted.kind === "prayer-encouragement" || submitted.kind === "prayer-answer" || submitted.kind === "prayer-wording") {
    const checkPrayer = async (payload: DraftPayload) => {
      if (!("baseline" in payload) || !payload.baseline || !("status" in payload.baseline)) throw new DraftError("invalid", "Missing prayer baseline.");
      const current = await database.prayers.get(payload.baseline.id);
      if (!current || current.deletedAt || current.revision !== payload.baseline.revision || current.status !== payload.baseline.status) throw new DraftError("stale", "This prayer changed or was removed. Review before saving.");
      if (current.status !== "ACTIVE" && current.status !== "WAITING") throw new DraftError("retired", "This prayer is read-only.");
    };
    operation = {
      tables: ["prayers", "prayerUpdates", "prayerResolutions", "activityEvents", "scriptureLinks", "prayerSchedules", "people", "categories", "reflections"],
      validate: submitted.kind === "prayer-create" ? async () => undefined : checkPrayer,
      save: async payload => {
        if (payload.kind === "prayer-create") {
          const administration = administrationInputFromValue(payload.administration);
          const source = payload.omitSource ? null : payload.sourceReflection;
          const saved = await prayers.createPrayer({ ...administration, body: payload.body, sourceDevotionDate: payload.localDate, sourceReflectionId: source?.id ?? null, ...(source ? { expectedSourceReflectionRevision: source.revision } : {}), scriptureReferences: payload.omitReferences ? [] : payload.references });
          return { records: [{ id: saved.id, revision: saved.revision }], disposition: "copy-only" };
        }
        if (payload.kind === "prayer-update" || payload.kind === "prayer-encouragement") {
          const saved = await prayers.addUpdate(payload.baseline.id, payload.body, payload.kind === "prayer-update" ? "update" : "encouragement");
          return { records: [{ id: saved.id, revision: saved.revision }], disposition: "copy-only" };
        }
        if (payload.kind === "prayer-answer") {
          if (payload.session) throw new DraftError("invalid", "Session answers require the session adapter; no action was recorded.");
          const saved = await prayers.answer(payload.baseline.id, payload.body, undefined, payload.baseline.revision);
          return { records: [{ id: saved.prayer.id, revision: saved.prayer.revision }, { id: saved.resolution.id, revision: saved.resolution.revision }], disposition: "copy-only" };
        }
        if (payload.kind === "prayer-wording") {
          const saved = await prayers.updateBody(payload.baseline.id, payload.body, payload.baseline.revision);
          return { records: [{ id: saved.id, revision: saved.revision }], disposition: "copy-only" };
        }
        throw new DraftError("invalid", "Wrong editor kind.");
      },
    };
  } else throw new DraftError("invalid", "This editor adapter is not connected yet.");
  return saveWithDraft(database, context, operation);
}
