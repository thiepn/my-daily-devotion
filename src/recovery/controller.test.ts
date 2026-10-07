import { afterEach, describe, expect, it, vi } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { DurableDraftController } from "./controller";
import { DraftRepository } from "./repository";
import { saveJournalDraft } from "./editor-adapters";
import type { DraftPayload } from "./types";
import { ReflectionRepository } from "../data/repositories/reflections";
import type { CommittedDraftSaveResult } from "./commit";
import type { Instant } from "../domain/types";

const databases: MddDatabase[] = [], controllers: DurableDraftController[] = [];
const payload = (bodyMd: string): Extract<DraftPayload, { kind: "reflection" }> => ({ kind: "reflection", localDate: "2026-10-07", bodyMd, baseline: null, pendingReferences: [], dismissedReferences: false });
async function setup() {
  const database = new MddDatabase(`draft-controller-${crypto.randomUUID()}`); databases.push(database); await prepareDatabase(database);
  const controller = new DurableDraftController(database, { returnTo: "/today", reading: null }); controllers.push(controller); return { database, controller };
}
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); for (const controller of controllers.splice(0)) controller.detach(); for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
const rebase = (latest: DraftPayload, submitted: DraftPayload, result: CommittedDraftSaveResult): DraftPayload => {
  if (latest.kind !== "reflection" || submitted.kind !== "reflection") throw new Error("Expected reflection");
  return { ...latest, baseline: { ...result.marker.records[0]!, bodyMd: submitted.bodyMd.trimEnd() } };
};

describe("serialized durable editor controller", () => {
  it("keeps pristine editors write-free and flushes only changed private writing", async () => {
    const { database, controller } = await setup(); await controller.flush();
    expect(await database.editorDrafts.count()).toBe(0);
    controller.stage(payload("One")); controller.stage(payload("One")); await controller.flush();
    expect(await database.editorDrafts.count()).toBe(1);
    expect((await database.editorDrafts.toArray())[0]?.generation).toBe(1);
    expect((await database.editorDraftContents.toArray())[0]?.payload).toEqual(payload("One"));
    expect(await database.reflections.count()).toBe(0); expect(await database.activityEvents.count()).toBe(0);
    expect(controller.getState().status).toBe("kept");
  });
  it("keeps the newest generation after 500 ms and never persists on each keystroke", async () => {
    const { database, controller } = await setup(); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    controller.stage(payload("First")); await vi.advanceTimersByTimeAsync(400); controller.stage(payload("Latest"));
    await vi.advanceTimersByTimeAsync(499); expect(await database.editorDrafts.count()).toBe(0);
    await vi.advanceTimersByTimeAsync(1); await controller.flush();
    expect((await database.editorDraftContents.toArray())[0]?.payload).toEqual(payload("Latest"));
    expect((await database.editorDrafts.toArray())[0]?.generation).toBe(2);
  });
  it("enforces the two-second maximum during continuous writing", async () => {
    const { database, controller } = await setup(); vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    for (let i = 0; i < 5; i++) { controller.stage(payload(String(i))); await vi.advanceTimersByTimeAsync(400); }
    // Await already-triggered work without flushing a not-yet-due debounce.
    await vi.waitFor(async () => expect(await database.editorDrafts.count()).toBe(1), { interval: 1 });
    expect((await database.editorDraftContents.toArray())[0]?.payload).toEqual(payload("4"));
  });
  it("independent editors for the same target retain separate IDs", async () => {
    const { database, controller } = await setup();
    const other = new DurableDraftController(database, { returnTo: "/today", reading: null }); controllers.push(other);
    controller.stage(payload("First tab")); other.stage(payload("Other tab")); await Promise.all([controller.flush(), other.flush()]);
    expect(await database.editorDrafts.count()).toBe(2); expect(controller.getId()).not.toBe(other.getId());
  });
  it("serializes a navigation flush and discard without resurrecting an ID", async () => {
    const { database, controller } = await setup(); controller.stage(payload("First"));
    const flush = controller.flush(), discard = controller.discard(); await Promise.all([flush, discard]);
    expect(await database.editorDraftContents.count()).toBe(0); expect((await database.editorDrafts.toArray())[0]?.state).toBe("discarded");
    controller.stage(payload("New editor writing")); await controller.flush();
    expect((await database.editorDrafts.filter(row => row.state === "active").toArray())).toHaveLength(1);
    expect(await database.activityEvents.count()).toBe(0);
  });
  it("reports failed storage, preserves values, and retries using the same UUID", async () => {
    const { database, controller } = await setup(); const original = DraftRepository.prototype.persist;
    const failure = vi.spyOn(DraftRepository.prototype, "persist").mockRejectedValueOnce(new Error("Storage unavailable"));
    controller.stage(payload("Keep me")); await expect(controller.flush()).rejects.toThrow("Storage unavailable"); const id = controller.getId();
    expect(controller.getState()).toEqual({ status: "failed", error: "Storage unavailable" });
    controller.stage(payload("Keep the latest too")); expect(controller.getState()).toEqual({ status: "failed", error: "Storage unavailable" });
    failure.mockImplementation(original);
    await controller.flush(); expect(controller.getId()).toBe(id); expect((await database.editorDraftContents.toArray())[0]?.payload).toEqual(payload("Keep the latest too"));
  });
  it("allows explicit save after a failed first draft checkpoint without duplicate activity", async () => {
    const { database, controller } = await setup(); vi.spyOn(DraftRepository.prototype, "persist").mockRejectedValue(new Error("Separate checkpoint failed"));
    controller.stage(payload("Explicitly saved")); const result = await controller.commit(context => saveJournalDraft(database, context), rebase);
    expect(result.reflection?.bodyMd).toBe("Explicitly saved"); expect(await database.reflections.count()).toBe(1); expect(await database.activityEvents.count()).toBe(1);
    expect((await database.editorDrafts.toArray())[0]?.state).toBe("committed");
  });
  it("rejects duplicate submissions and preserves newer typing with the saved baseline", async () => {
    const { database, controller } = await setup(); controller.stage(payload("Submitted"));
    let release!: () => void, entered!: () => void; const ready = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    const commit = controller.commit(async context => { entered(); await gate; return saveJournalDraft(database, context); }, rebase);
    await ready; await expect(controller.commit(context => saveJournalDraft(database, context))).rejects.toThrow("already in progress");
    controller.stage(payload("Newer typing")); release(); const result = await commit; await controller.flush();
    const kept = await new DraftRepository(database).read(controller.getId()!);
    expect(kept.kind).toBe("active"); if (kept.kind !== "active") throw new Error("Expected new writing");
    expect(kept.snapshot.contents.payload).toMatchObject({ bodyMd: "Newer typing", baseline: { id: result.marker.records[0]!.id, revision: 1, bodyMd: "Submitted" } });
    expect(await database.activityEvents.count()).toBe(1);
    const next = await controller.commit(context => saveJournalDraft(database, context), rebase);
    expect(next.reflection?.revision).toBe(2); expect(await database.activityEvents.count()).toBe(1);
  });
  it("saves the latest valid writing when an existing draft's subsequent checkpoint fails", async () => {
    const { database, controller } = await setup(); controller.stage(payload("Older kept text")); await controller.flush();
    vi.spyOn(DraftRepository.prototype, "persist").mockRejectedValue(new Error("Private checkpoint unavailable"));
    controller.stage(payload("Newer explicit save")); await expect(controller.flush()).rejects.toThrow("Private checkpoint unavailable");
    const saved = await controller.commit(context => saveJournalDraft(database, context), rebase);
    expect(saved.reflection?.bodyMd).toBe("Newer explicit save");
    expect((await database.editorDrafts.get(controller.getId()!))?.generation).toBe(2);
    expect(await database.editorDraftContents.count()).toBe(0); expect(await database.activityEvents.count()).toBe(1);
  });
  it("does not silently save or recreate a known draft that disappeared", async () => {
    const { database, controller } = await setup(); controller.stage(payload("Known writing")); await controller.flush();
    const id = controller.getId()!;
    await database.transaction("rw", database.editorDrafts, database.editorDraftContents, async () => { await database.editorDrafts.delete(id); await database.editorDraftContents.delete(id); });
    controller.stage(payload("Latest writing stays in memory"));
    await expect(controller.commit(context => saveJournalDraft(database, context), rebase)).rejects.toThrow("no longer available");
    expect(await database.reflections.count()).toBe(0); expect(await database.activityEvents.count()).toBe(0); expect(await database.editorDrafts.count()).toBe(0);
  });
  it("keeps domain-save failures separate from an acknowledged recovery checkpoint", async () => {
    const { database, controller } = await setup(); controller.stage(payload("Kept writing")); await controller.flush();
    await expect(controller.commit(async () => { throw new Error("Domain save unavailable"); })).rejects.toThrow("Domain save unavailable");
    expect(controller.getState().status).toBe("kept"); expect(await database.reflections.count()).toBe(0);
    expect((await new DraftRepository(database).read(controller.getId()!)).kind).toBe("active");
  });
  it("makes a recovered fork explicit and keeps the source until a successful save", async () => {
    const { database, controller } = await setup(); controller.stage(payload("Recovered writing")); await controller.flush();
    const id = controller.getId()!, other = new DurableDraftController(database, { returnTo: "/today", reading: null }); controllers.push(other);
    expect(await other.recover(id, 1)).toEqual(payload("Recovered writing")); expect(other.getId()).not.toBe(id);
    expect(await database.editorDrafts.count()).toBe(2); expect(await database.reflections.count()).toBe(0);
    await other.commit(context => saveJournalDraft(database, context), rebase);
    expect((await database.editorDrafts.get(id))?.state).toBe("committed"); expect(await database.activityEvents.count()).toBe(1);
  });
  it("rolls domain removal and draft retirement back together if removal fails", async () => {
    const { database, controller } = await setup(); const reflection = (await new ReflectionRepository(database).saveDaily("2026-10-07", "Saved")).reflection;
    controller.stage({ ...payload("Unsaved changes"), baseline: { id: reflection.id, revision: reflection.revision, bodyMd: reflection.bodyMd } }); await controller.flush();
    await expect(controller.discard({ tables: ["reflections"], action: async () => { await database.reflections.update(reflection.id, { deletedAt: new Date().toISOString() as Instant }); throw new Error("Removal failed"); } })).rejects.toThrow("Removal failed");
    expect((await database.reflections.get(reflection.id))?.deletedAt).toBeNull(); expect((await new DraftRepository(database).read(controller.getId()!)).kind).toBe("active");
  });
});
