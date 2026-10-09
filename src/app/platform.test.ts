import { describe, expect, it, vi } from "vitest";
import { activateWaitingServiceWorker } from "./platform";
import { protectApplicationUpdate } from "./update-protection";

describe("P8 safe service worker activation", () => {
  it("does not send SKIP_WAITING to an unqualified worker that rejects the message", async () => {
    const message = vi.fn(() => { throw new Error("Worker is unavailable"); });
    vi.stubGlobal("navigator", { serviceWorker: {} });
    try {
      expect(await activateWaitingServiceWorker({ waiting: { postMessage: message } } as unknown as ServiceWorkerRegistration)).toBe(false);
      expect(message).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
  it("refuses activation while writing is protected, even if a worker is waiting", async () => {
    const message = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: {} });
    const stop = protectApplicationUpdate();
    try {
      expect(await activateWaitingServiceWorker({ waiting: { postMessage: message } } as unknown as ServiceWorkerRegistration)).toBe(false);
      expect(message).not.toHaveBeenCalled();
    } finally { stop(); vi.unstubAllGlobals(); }
  });
});
