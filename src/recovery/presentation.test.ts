import { afterEach, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import { ReflectionRepository } from "../data/repositories/reflections";
import { DurableDraftController } from "./controller";
import { DraftRepository } from "./repository";
import { DRAFT_LABELS, draftFields, draftTargetLabel, parseRecoveryContext, reflectionRecoveryDestination } from "./presentation";
import type { DraftPayload } from "./types";

const databases: MddDatabase[] = [], controllers: DurableDraftController[] = [];
afterEach(async () => { for (const controller of controllers.splice(0)) controller.detach(); for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
async function setup(baseline: Extract<DraftPayload, { kind: "reflection" }>["baseline"] = null) {
  const database = new MddDatabase(`recovery-directory-${crypto.randomUUID()}`); databases.push(database); await prepareDatabase(database);
  const controller = new DurableDraftController(database, { returnTo: "/history?period=2025&view=reflections&shown=35", reading: null }); controllers.push(controller);
  controller.stage({ kind: "reflection", localDate: "2026-10-07", bodyMd: "Private unfinished writing", baseline, pendingReferences: [], dismissedReferences: false }); await controller.flush();
  return { database, controller, repository: new DraftRepository(database) };
}
it("normalizes malformed pagination and external returns without adopting them", () => {
  expect(parseRecoveryContext("?shown=40&return=%2Fhistory%3Fview%3Dprayer")).toEqual({ shown: 40, returnTo: "/history?view=prayer" });
  for (const search of ["?shown=Infinity", "?shown=-20", "?shown=100001", "?shown=NaN&return=https://example.com", "?return=//example.com"]) expect(parseRecoveryContext(search)).toEqual({ shown: 20, returnTo: "/data" });
});
it("directory descriptions exclude private bodies and record names", async () => {
  const { repository } = await setup(); const page = await repository.list();
  expect(page.total).toBe(1); expect(draftTargetLabel(page.rows[0]!.metadata!)).toBe("2026-10-07");
  expect(JSON.stringify(page)).not.toContain("Private unfinished writing");
  expect(Object.keys(DRAFT_LABELS)).toHaveLength(15);
});
it("review and recovery destinations perform no writes and retain the original context", async () => {
  const { database, controller, repository } = await setup();
  const before = await Promise.all(database.tables.map(table => table.toArray()));
  const read = await repository.read(controller.getId()!);
  const destination = await reflectionRecoveryDestination(database, read);
  expect(destination).toContain("/today/reflection/2026-10-07?");
  expect(new URLSearchParams(destination!.split("?")[1]).get("return")).toBe("/history?period=2025&view=reflections&shown=35");
  expect(await Promise.all(database.tables.map(table => table.toArray()))).toEqual(before);
  expect(read.kind === "active" && draftFields(read.snapshot.contents.payload)).toEqual([{ label: "Your reflection", text: "Private unfinished writing" }]);
});
it("removed Reflection targets remain copyable without a recreate destination", async () => {
  const database = new MddDatabase(`removed-draft-${crypto.randomUUID()}`); databases.push(database); await prepareDatabase(database);
  const reflections = new ReflectionRepository(database), record = (await reflections.saveDaily("2026-10-07", "Saved writing", null)).reflection;
  const controller = new DurableDraftController(database, { returnTo: "/today", reading: null }); controllers.push(controller);
  controller.stage({ kind: "reflection", localDate: "2026-10-07", bodyMd: "Keep my draft", baseline: { id: record.id, revision: record.revision, bodyMd: record.bodyMd }, pendingReferences: [], dismissedReferences: false }); await controller.flush();
  await reflections.removeDaily("2026-10-07", record.revision);
  const result = await new DraftRepository(database).read(controller.getId()!);
  expect(result.kind).toBe("active"); expect(await reflectionRecoveryDestination(database, result)).toBeNull();
  expect(result.kind === "active" && draftFields(result.snapshot.contents.payload)[0]?.text).toBe("Keep my draft");
});
it("previous-journal and already-recorded writing never gets an automatic editor handoff", async () => {
  const { database, controller, repository } = await setup(); const result = await repository.read(controller.getId()!);
  if (result.kind !== "active") throw new Error("Expected draft");
  expect(await reflectionRecoveryDestination(database, { ...result, previousJournal: true })).toBeNull();
  expect(await reflectionRecoveryDestination(database, { ...result, snapshot: { ...result.snapshot, metadata: { ...result.snapshot.metadata, commitment: { operationId: crypto.randomUUID(), submittedGeneration: 1, targetKey: result.snapshot.metadata.targetKey, committedAt: new Date().toISOString(), records: [], disposition: "copy-only" } } } })).toBeNull();
});
it("a discard confirmed against an earlier generation cannot erase newer kept writing", async () => {
  const { controller, repository } = await setup(), id = controller.getId()!;
  const read = await repository.read(id); if (read.kind !== "active") throw new Error("Expected draft");
  controller.stage({ ...read.snapshot.contents.payload, bodyMd: "Newer writing" } as DraftPayload); await controller.flush();
  await expect(repository.discard(id, read.snapshot.metadata.generation)).rejects.toMatchObject({ code: "stale" });
  const latest = await repository.read(id); expect(latest.kind === "active" && draftFields(latest.snapshot.contents.payload)[0]?.text).toBe("Newer writing");
});
