import { describe, expect, it } from "vitest";
import type { LocalDate, PrayerSchedule } from "../domain/types";
import { localDateInTimeZone } from "../domain/time";
import { addLocalDays, daysBetween, eventQueueReason, isScheduleDue, normalizePrayerScheduleDraft } from "./scheduling";

function schedule(fields: ReturnType<typeof normalizePrayerScheduleDraft>): PrayerSchedule {
  return { id: "s", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", revision: 1, deletedAt: null, ...fields } as PrayerSchedule;
}
const basePrayer = { eventDate: null, focusUntil: null } as any;

describe("prayer scheduling", () => {
  it("evaluates daily, weekday, interval, monthly-clamped and one-date rules only for the current date", () => {
    expect(isScheduleDue(schedule(normalizePrayerScheduleDraft({ mode: "DAILY" })), "2026-09-16")).toBe(true);
    expect(isScheduleDue(schedule(normalizePrayerScheduleDraft({ mode: "WEEKDAYS", weekdays: [3] })), "2026-09-16")).toBe(true);
    expect(isScheduleDue(schedule(normalizePrayerScheduleDraft({ mode: "WEEKDAYS", weekdays: [1] })), "2026-09-16")).toBe(false);
    const interval = schedule(normalizePrayerScheduleDraft({ mode: "INTERVAL_DAYS", intervalDays: 3, anchorDate: "2026-09-15" }));
    expect(isScheduleDue(interval, "2026-09-18")).toBe(true);
    expect(isScheduleDue(interval, "2026-09-16")).toBe(false);
    const monthly = schedule(normalizePrayerScheduleDraft({ mode: "MONTHLY", monthlyDay: 31 }));
    expect(isScheduleDue(monthly, "2026-02-28")).toBe(true);
    const once = schedule(normalizePrayerScheduleDraft({ mode: "ON_DATE", onDate: "2026-09-15" }));
    expect(isScheduleDue(once, "2026-09-16")).toBe(false);
  });

  it("uses calendar-day arithmetic that is unaffected by DST", () => {
    expect(addLocalDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addLocalDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("derives the current local date from an IANA timezone without shifting stored historical dates", () => {
    const instant = new Date("2026-09-16T22:30:00.000Z");
    expect(localDateInTimeZone(instant, "Europe/Berlin")).toBe("2026-09-17");
    expect(localDateInTimeZone(instant, "America/New_York")).toBe("2026-09-16");
  });

  it("boosts an event only tomorrow, today, and one follow-up day", () => {
    expect(eventQueueReason({ ...basePrayer, eventDate: "2026-09-17" as LocalDate }, "2026-09-16")).toBe("event-tomorrow");
    expect(eventQueueReason({ ...basePrayer, eventDate: "2026-09-16" as LocalDate }, "2026-09-16")).toBe("event-today");
    expect(eventQueueReason({ ...basePrayer, eventDate: "2026-09-15" as LocalDate }, "2026-09-16")).toBe("event-follow-up");
    expect(eventQueueReason({ ...basePrayer, eventDate: "2026-09-14" as LocalDate }, "2026-09-16")).toBeNull();
  });
});
