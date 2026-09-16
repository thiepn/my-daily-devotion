import { createId, nowInstant } from "../domain/identity";
import { currentTimeZone, todayLocalDate } from "../domain/time";
import type { ActivityEvent, ActivityEventType, LocalDate, TimeZoneId } from "../domain/types";
import type { MddDatabase } from "./database";

export interface RecordActivityInput {
  type: ActivityEventType;
  subjectType: string;
  subjectId: string;
  localDate?: LocalDate;
  timeZone?: TimeZoneId;
  metadata?: Record<string, unknown>;
}

export class ActivityLog {
  constructor(private readonly database: MddDatabase) {}

  async record(input: RecordActivityInput): Promise<ActivityEvent> {
    const event: ActivityEvent = {
      id: createId(),
      type: input.type,
      localDate: input.localDate ?? todayLocalDate(),
      occurredAt: nowInstant(),
      timeZone: input.timeZone ?? currentTimeZone(),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      metadata: input.metadata ?? {},
    };
    await this.database.activityEvents.add(event);
    return event;
  }
}
