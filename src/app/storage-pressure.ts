export const STORAGE_WRITE_FAILURE_EVENT = "mdd:storage-write-failure";
export type StoragePressure = "unknown" | "normal" | "high";
export function classifyStoragePressure(usage: number | null, quota: number | null): StoragePressure {
  if (usage === null || quota === null || !Number.isFinite(usage) || !Number.isFinite(quota) || usage < 0 || quota <= 0) return "unknown";
  return usage / quota >= 0.9 ? "high" : "normal";
}
export function isStorageQuotaFailure(reason: unknown): boolean {
  let candidate: unknown = reason;
  for (let i = 0; i < 4 && typeof candidate === "object" && candidate !== null; i++) {
    const value = candidate as { name?: unknown; inner?: unknown; cause?: unknown };
    if (value.name === "QuotaExceededError" || value.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
    candidate = value.inner ?? value.cause;
  }
  return false;
}
/** No error strings, writing content or records are carried in this event. */
export function reportStorageWriteFailure(reason: unknown): void {
  if (isStorageQuotaFailure(reason) && typeof window !== "undefined") window.dispatchEvent(new Event(STORAGE_WRITE_FAILURE_EVENT));
}
