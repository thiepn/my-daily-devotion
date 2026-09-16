import type { MddDatabase } from "../data/database";
import { currentTimeZone, localDateInTimeZone } from "../domain/time";
import type { LocalDate, Prayer, PrayerSchedule, TimeZoneId, UUID } from "../domain/types";
import { eventQueueReason, isFocusActive, isScheduleDue } from "./scheduling";

export type PrayerQueueBand = "FOCUS_OR_EVENT" | "FIXED_DUE" | "NEVER_PRAYED" | "ROTATION";
export interface PrayerQueueEntry {
  prayer: Prayer;
  schedule: PrayerSchedule | null;
  band: PrayerQueueBand;
  reason: string;
}

function stablePrayerSort(a: Prayer, b: Prayer): number {
  if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
  return a.id.localeCompare(b.id);
}

function rotationSort(a: Prayer, b: Prayer): number {
  if (a.lastPrayedAt === null && b.lastPrayedAt !== null) return -1;
  if (a.lastPrayedAt !== null && b.lastPrayedAt === null) return 1;
  if (a.lastPrayedAt !== b.lastPrayedAt) return (a.lastPrayedAt ?? "").localeCompare(b.lastPrayedAt ?? "");
  return stablePrayerSort(a, b);
}

function priorityReason(prayer: Prayer, localDate: LocalDate): string | null {
  const event = eventQueueReason(prayer, localDate);
  if (event) return event;
  if (isFocusActive(prayer, localDate)) return "focus";
  return null;
}

function prayedOnDate(prayer: Prayer, localDate: LocalDate, timeZone: TimeZoneId): boolean {
  return prayer.lastPrayedAt !== null && localDateInTimeZone(prayer.lastPrayedAt, timeZone) === localDate;
}

export class PrayerQueueService {
  constructor(private readonly database: MddDatabase) {}

  async build(
    localDate: LocalDate,
    target: number,
    excludedPrayerIds: ReadonlySet<UUID> = new Set(),
    timeZone: TimeZoneId = currentTimeZone(),
  ): Promise<PrayerQueueEntry[]> {
    const [prayers, schedules] = await Promise.all([
      this.database.prayers.where("status").equals("ACTIVE").filter((item) => item.deletedAt === null).toArray(),
      this.database.prayerSchedules.filter((item) => item.deletedAt === null).toArray(),
    ]);
    const scheduleMap = new Map(schedules.map((item) => [item.id, item]));
    const eligible = prayers.filter((prayer) => !excludedPrayerIds.has(prayer.id));
    const scheduled = (prayer: Prayer) => prayer.scheduleId ? scheduleMap.get(prayer.scheduleId) ?? null : null;
    const automatic = eligible.filter((prayer) => scheduled(prayer)?.mode !== "MANUAL_ONLY");
    const result: PrayerQueueEntry[] = [];
    const seen = new Set<UUID>();
    const push = (prayer: Prayer, band: PrayerQueueBand, reason: string) => {
      if (seen.has(prayer.id)) return;
      seen.add(prayer.id);
      result.push({ prayer, schedule: scheduled(prayer), band, reason });
    };

    automatic
      .filter((prayer) => priorityReason(prayer, localDate) !== null)
      .sort(stablePrayerSort)
      .forEach((prayer) => push(prayer, "FOCUS_OR_EVENT", priorityReason(prayer, localDate)!));

    automatic
      .filter((prayer) => {
        const schedule = scheduled(prayer);
        return schedule !== null && schedule.mode !== "ROTATION" && isScheduleDue(schedule, localDate) && !prayedOnDate(prayer, localDate, timeZone);
      })
      .sort(stablePrayerSort)
      .forEach((prayer) => push(prayer, "FIXED_DUE", `schedule:${scheduled(prayer)!.mode}`));

    const normalizedTarget = Math.max(1, Math.floor(target));
    if (result.length >= normalizedTarget) return result;

    automatic
      .filter((prayer) => prayer.lastPrayedAt === null)
      .sort(stablePrayerSort)
      .some((prayer) => {
        push(prayer, "NEVER_PRAYED", "never-prayed");
        return result.length >= normalizedTarget;
      });
    if (result.length >= normalizedTarget) return result;

    automatic
      .filter((prayer) => {
        const schedule = scheduled(prayer);
        return schedule === null || schedule.mode === "ROTATION";
      })
      .sort(rotationSort)
      .some((prayer) => {
        push(prayer, "ROTATION", "least-recently-prayed");
        return result.length >= normalizedTarget;
      });

    return result;
  }
}
