import { describe, expect, it, vi } from "vitest";
import { classifyStoragePressure, isStorageQuotaFailure, reportStorageWriteFailure, STORAGE_WRITE_FAILURE_EVENT } from "./storage-pressure";
describe("P8 conservative storage-pressure signals", () => {
  it("warns only on a finite estimated usage ratio of 90% or greater", () => {
    expect(classifyStoragePressure(89, 100)).toBe("normal");
    expect(classifyStoragePressure(90, 100)).toBe("high");
    expect(classifyStoragePressure(99, 100)).toBe("high");
    expect(classifyStoragePressure(null, 100)).toBe("unknown");
    expect(classifyStoragePressure(100, 0)).toBe("unknown");
    expect(classifyStoragePressure(Number.NaN, 100)).toBe("unknown");
    expect(classifyStoragePressure(-5, 100)).toBe("unknown");
  });
  it("distinguishes quota exceptions from network, permission and generic storage errors", () => {
    expect(isStorageQuotaFailure({ name: "QuotaExceededError" })).toBe(true);
    expect(isStorageQuotaFailure({ name: "DatabaseClosedError", inner: { name: "QuotaExceededError" } })).toBe(true);
    expect(isStorageQuotaFailure({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isStorageQuotaFailure({ name: "UnknownError" })).toBe(false);
    expect(isStorageQuotaFailure(null)).toBe(false);
  });
  it("does not dispatch user content or alerts for unrelated failures", () => {
    const spy = vi.fn();
    vi.stubGlobal("window", new EventTarget());
    window.addEventListener(STORAGE_WRITE_FAILURE_EVENT, spy);
    try {
      reportStorageWriteFailure(new Error("a private journal entry"));
      expect(spy).not.toHaveBeenCalled();
      reportStorageWriteFailure({ name: "QuotaExceededError", message: "sensitive journal" });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toHaveLength(1);
      expect(spy.mock.calls[0]?.[0]).toHaveProperty("type", STORAGE_WRITE_FAILURE_EVENT);
      expect(JSON.stringify(spy.mock.calls[0])).not.toContain("sensitive journal");
    } finally { window.removeEventListener(STORAGE_WRITE_FAILURE_EVENT, spy); vi.unstubAllGlobals(); }
  });
});
