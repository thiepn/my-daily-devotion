import type { PrayerStatus } from "./types";

const ALLOWED_TRANSITIONS: Readonly<Record<PrayerStatus, readonly PrayerStatus[]>> = {
  ACTIVE: ["WAITING", "ANSWERED", "ARCHIVED"],
  WAITING: ["ACTIVE", "ANSWERED", "ARCHIVED"],
  ANSWERED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionPrayer(from: PrayerStatus, to: PrayerStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPrayerTransition(from: PrayerStatus, to: PrayerStatus): void {
  if (!canTransitionPrayer(from, to)) {
    throw new Error(`Illegal prayer lifecycle transition: ${from} → ${to}`);
  }
}
