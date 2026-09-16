import { afterEach, describe, expect, it } from "vitest";
import { MddDatabase, prepareDatabase } from "../data/database";
import type { LocalDate } from "../domain/types";
import { McheyneRepository } from "./repository";
import type { McheyneAssignment, McheynePlan, McheyneReading } from "./types";

const databases: MddDatabase[] = [];
function testDb(): MddDatabase {
  const database = new MddDatabase(`mdd-mcheyne-test-${crypto.randomUUID()}`);
  databases.push(database);
  return database;
}

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
    await database.delete();
  }
});

const family: McheyneReading = { group: "family", displayReference: "Genesis 1", references: [{ translationId: "BSB", startVerseKey: "GEN.1.1", endVerseKey: "GEN.1.31" }] };
const secret: McheyneReading = { ...family, group: "secret" };
function assignment(sequence: number, calendarKey: string): McheyneAssignment {
  return { sequence, calendarKey, readings: [family, family, secret, secret] };
}
const plan = { planId: "mcheyne-classic", version: 1, assignments: [assignment(1, "01-01"), assignment(2, "01-02"), assignment(3, "01-03")] } as McheynePlan;

describe("McheyneRepository", () => {
  it("records explicit completion, devotion history, and reversible state", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new McheyneRepository(database);
    const date = "2026-01-01" as LocalDate;
    const enrollment = await repository.enrollCalendar(date, 1);

    const completed = await repository.setReadingCompleted(enrollment.id, 1, 0, true, date);
    expect(completed?.completedAt).not.toBeNull();
    expect(await database.devotionDays.count()).toBe(1);
    expect((await database.activityEvents.toArray()).map((event) => event.type)).toEqual(["READING_COMPLETED"]);

    const undone = await repository.setReadingCompleted(enrollment.id, 1, 0, false, date);
    expect(undone?.completedAt).toBeNull();
    expect(undone?.revision).toBe((completed?.revision ?? 0) + 1);
    expect(await database.activityEvents.count()).toBe(1);
  });

  it("bulk imports state without fabricating devotional activity", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new McheyneRepository(database);
    const enrollment = await repository.enrollCalendar("2026-09-16" as LocalDate, 259);

    expect(await repository.bulkImportThrough(enrollment.id, 2)).toBe(8);
    expect((await repository.listProgress(enrollment.id)).filter((item) => item.completedAt !== null)).toHaveLength(8);
    expect((await repository.getEnrollment(enrollment.id))?.startSequence).toBe(1);
    expect(await database.activityEvents.count()).toBe(0);
    expect(await database.devotionDays.count()).toBe(0);
  });

  it("advances self-paced mode only when all four readings are explicitly complete", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new McheyneRepository(database);
    const enrollment = await repository.enrollSelfPaced("2026-09-16" as LocalDate);

    expect(await repository.getCurrentSelfPacedSequence(plan, enrollment)).toBe(1);
    for (let index = 0; index < 4; index += 1) await repository.setReadingCompleted(enrollment.id, 1, index, true);
    expect(await repository.getCurrentSelfPacedSequence(plan, enrollment)).toBe(2);
  });

  it("does not invent backlog before a calendar enrollment start sequence", async () => {
    const database = testDb();
    await prepareDatabase(database);
    const repository = new McheyneRepository(database);
    const enrollment = await repository.enrollCalendar("2026-01-02" as LocalDate, 2);
    const unread = await repository.getEarlierUnreadAssignments(plan, enrollment, 3);
    expect(unread.map((item) => item.assignment.sequence)).toEqual([2]);
  });
});
