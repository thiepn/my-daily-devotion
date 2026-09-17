import { ActivityLog } from "../data/activity";
import { db, type MddDatabase } from "../data/database";
import { DevotionDayRepository } from "../data/repositories/devotion-days";
import { newMutableFields, nextMutableFields, nowInstant } from "../domain/identity";
import { todayLocalDate } from "../domain/time";
import type { LocalDate, PlanEnrollment, ReadingProgress, UUID } from "../domain/types";
import { calendarYear } from "./calendar";
import type { AssignmentProgressSummary, McheynePlan } from "./types";

const ACTIVE_ENROLLMENT_KEY = "mcheyne.activeEnrollmentId";

function readingKey(sequence: number, readingIndex: number): string {
  return `${sequence}:${readingIndex}`;
}

function isComplete(progress: ReadingProgress | undefined): boolean {
  return progress?.deletedAt === null && progress.completedAt !== null;
}

export class McheyneRepository {
  private readonly activity: ActivityLog;
  private readonly devotionDays: DevotionDayRepository;

  constructor(private readonly database: MddDatabase = db) {
    this.activity = new ActivityLog(database);
    this.devotionDays = new DevotionDayRepository(database);
  }

  async getEnrollment(id: UUID): Promise<PlanEnrollment | undefined> {
    const enrollment = await this.database.planEnrollments.get(id);
    return enrollment?.deletedAt ? undefined : enrollment;
  }

  async getActiveEnrollment(localDate: LocalDate = todayLocalDate()): Promise<PlanEnrollment | undefined> {
    const preferred = await this.database.preferences.get(ACTIVE_ENROLLMENT_KEY);
    const preferredId = typeof preferred?.value === "string" ? preferred.value : null;
    if (preferredId) {
      const enrollment = await this.getEnrollment(preferredId);
      if (enrollment && this.appliesToDate(enrollment, localDate)) return enrollment;
    }

    const enrollments = (await this.database.planEnrollments.toArray())
      .filter((item) => item.deletedAt === null && item.planId === "mcheyne-classic" && item.planVersion === 1)
      .filter((item) => this.appliesToDate(item, localDate))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const fallback = enrollments[0];
    if (fallback) await this.setActiveEnrollment(fallback.id);
    return fallback;
  }

  private appliesToDate(enrollment: PlanEnrollment, localDate: LocalDate): boolean {
    return enrollment.mode === "SELF_PACED" || calendarYear(enrollment.startedOn) === calendarYear(localDate);
  }

  private async setActiveEnrollment(id: UUID): Promise<void> {
    await this.database.preferences.put({ key: ACTIVE_ENROLLMENT_KEY, value: id, updatedAt: nowInstant() });
  }

  async enrollCalendar(localDate: LocalDate, startSequence: number): Promise<PlanEnrollment> {
    const enrollment: PlanEnrollment = {
      ...newMutableFields(),
      planId: "mcheyne-classic",
      planVersion: 1,
      mode: "CALENDAR",
      startedOn: localDate,
      startSequence,
    };
    await this.database.transaction("rw", this.database.planEnrollments, this.database.preferences, async () => {
      await this.database.planEnrollments.add(enrollment);
      await this.setActiveEnrollment(enrollment.id);
    });
    return enrollment;
  }

  async enrollSelfPaced(localDate: LocalDate): Promise<PlanEnrollment> {
    const enrollment: PlanEnrollment = {
      ...newMutableFields(),
      planId: "mcheyne-classic",
      planVersion: 1,
      mode: "SELF_PACED",
      startedOn: localDate,
      startSequence: 1,
    };
    await this.database.transaction("rw", this.database.planEnrollments, this.database.preferences, async () => {
      await this.database.planEnrollments.add(enrollment);
      await this.setActiveEnrollment(enrollment.id);
    });
    return enrollment;
  }

  async listProgress(enrollmentId: UUID): Promise<ReadingProgress[]> {
    return this.database.readingProgress
      .where("planEnrollmentId")
      .equals(enrollmentId)
      .filter((item) => item.deletedAt === null)
      .toArray();
  }

  async getReadingProgress(enrollmentId: UUID, sequence: number, readingIndex: number): Promise<ReadingProgress | undefined> {
    return this.database.readingProgress.where("[planEnrollmentId+assignmentSequence+readingIndex]").equals([enrollmentId, sequence, readingIndex]).filter((item) => item.deletedAt === null).first();
  }

  async completionMap(enrollmentId: UUID): Promise<Map<string, ReadingProgress>> {
    return new Map((await this.listProgress(enrollmentId)).map((item) => [readingKey(item.assignmentSequence, item.readingIndex), item]));
  }

  async setReadingCompleted(
    enrollmentId: UUID, sequence: number, readingIndex: number, completed: boolean, localDate: LocalDate = todayLocalDate(),
  ): Promise<ReadingProgress | undefined> {
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 365 || !Number.isInteger(readingIndex) || readingIndex < 0 || readingIndex > 3) throw new Error("Invalid reading assignment.");
    return this.database.transaction("rw", [this.database.planEnrollments, this.database.readingProgress, this.database.devotionDays, this.database.activityEvents], async () => {
      if (!await this.getEnrollment(enrollmentId)) throw new Error("Reading plan is no longer available.");
      return this.setReadingCompletedInternal(enrollmentId, sequence, readingIndex, completed, localDate);
    });
  }

  private async setReadingCompletedInternal(
    enrollmentId: UUID,
    sequence: number,
    readingIndex: number,
    completed: boolean,
    localDate: LocalDate = todayLocalDate(),
  ): Promise<ReadingProgress | undefined> {
    const current = await this.getReadingProgress(enrollmentId, sequence, readingIndex);
    if (completed && isComplete(current)) return current;
    if (!completed && !isComplete(current)) return current;

    const at = nowInstant();
    if (!completed && current) {
      const next: ReadingProgress = { ...current, ...nextMutableFields(current, at), completedAt: null };
      await this.database.readingProgress.put(next);
      return next;
    }

    const progress: ReadingProgress = current
      ? { ...current, ...nextMutableFields(current, at), completedAt: at, deletedAt: null }
      : {
          ...newMutableFields(at),
          planEnrollmentId: enrollmentId,
          assignmentSequence: sequence,
          readingIndex,
          completedAt: at,
        };

    await this.database.transaction(
      "rw",
      this.database.readingProgress,
      this.database.devotionDays,
      this.database.activityEvents,
      async () => {
        await this.database.readingProgress.put(progress);
        await this.devotionDays.ensure(localDate, enrollmentId);
        await this.activity.record({
          type: "READING_COMPLETED",
          subjectType: "readingProgress",
          subjectId: progress.id,
          localDate,
          metadata: { planId: "mcheyne-classic", enrollmentId, assignmentSequence: sequence, readingIndex },
        });
      },
    );
    return progress;
  }

  async bulkImportThrough(enrollmentId: UUID, throughSequence: number): Promise<number> {
    const enrollment = await this.getEnrollment(enrollmentId);
    if (!enrollment) throw new Error("M'Cheyne enrollment not found.");
    const bounded = Math.max(0, Math.min(365, throughSequence));
    const existing = await this.listProgress(enrollmentId);
    const byKey = new Map(existing.map((item) => [readingKey(item.assignmentSequence, item.readingIndex), item]));
    const at = nowInstant();
    const rows: ReadingProgress[] = [];

    for (let sequence = 1; sequence <= bounded; sequence += 1) {
      for (let readingIndex = 0; readingIndex < 4; readingIndex += 1) {
        const current = byKey.get(readingKey(sequence, readingIndex));
        if (isComplete(current)) continue;
        rows.push(current
          ? { ...current, ...nextMutableFields(current, at), completedAt: at, deletedAt: null }
          : {
              ...newMutableFields(at),
              planEnrollmentId: enrollmentId,
              assignmentSequence: sequence,
              readingIndex,
              completedAt: at,
            });
      }
    }

    const nextEnrollment: PlanEnrollment = enrollment.startSequence === 1
      ? enrollment
      : { ...enrollment, ...nextMutableFields(enrollment, at), startSequence: 1 };

    await this.database.transaction("rw", this.database.readingProgress, this.database.planEnrollments, async () => {
      if (rows.length > 0) await this.database.readingProgress.bulkPut(rows);
      if (nextEnrollment !== enrollment) await this.database.planEnrollments.put(nextEnrollment);
    });
    return rows.length;
  }

  async getCurrentSelfPacedSequence(plan: McheynePlan, enrollment: PlanEnrollment): Promise<number | null> {
    const progress = await this.completionMap(enrollment.id);
    for (let sequence = enrollment.startSequence; sequence <= plan.assignments.length; sequence += 1) {
      const complete = [0, 1, 2, 3].every((index) => isComplete(progress.get(readingKey(sequence, index))));
      if (!complete) return sequence;
    }
    return null;
  }

  async getAssignmentSummary(plan: McheynePlan, enrollmentId: UUID, sequence: number): Promise<AssignmentProgressSummary | null> {
    const assignment = plan.assignments.find((item) => item.sequence === sequence);
    if (!assignment) return null;
    const progress = await this.completionMap(enrollmentId);
    const completedCount = [0, 1, 2, 3].filter((index) => isComplete(progress.get(readingKey(sequence, index)))).length;
    return { assignment, completedCount };
  }

  async getEarlierUnreadAssignments(
    plan: McheynePlan,
    enrollment: PlanEnrollment,
    beforeSequence: number,
  ): Promise<AssignmentProgressSummary[]> {
    const progress = await this.completionMap(enrollment.id);
    const result: AssignmentProgressSummary[] = [];
    for (let sequence = enrollment.startSequence; sequence < beforeSequence; sequence += 1) {
      const assignment = plan.assignments[sequence - 1];
      if (!assignment) continue;
      const completedCount = [0, 1, 2, 3].filter((index) => isComplete(progress.get(readingKey(sequence, index)))).length;
      if (completedCount < 4) result.push({ assignment, completedCount });
    }
    return result;
  }
}
