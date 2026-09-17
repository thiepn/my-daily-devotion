export const PLATFORM_UPDATE_EVENT = "mdd:update-ready";

export type StoragePersistenceState = "granted" | "not-granted" | "unsupported";

export interface StorageSnapshot {
  persistence: StoragePersistenceState;
  usage: number | null;
  quota: number | null;
}

let reloadForUpdate = false;

function supportsStorageManager(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.storage);
}

export async function inspectStorage(requestPersistence = false): Promise<StorageSnapshot> {
  if (!supportsStorageManager()) return { persistence: "unsupported", usage: null, quota: null };

  const storage = navigator.storage;
  let persistent = typeof storage.persisted === "function" ? await storage.persisted() : false;
  if (!persistent && requestPersistence && typeof storage.persist === "function") {
    persistent = await storage.persist();
  }
  const estimate = typeof storage.estimate === "function" ? await storage.estimate() : {};
  return {
    persistence: typeof storage.persisted === "function" ? (persistent ? "granted" : "not-granted") : "unsupported",
    usage: typeof estimate.usage === "number" ? estimate.usage : null,
    quota: typeof estimate.quota === "number" ? estimate.quota : null,
  };
}

function announceUpdate(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(new CustomEvent(PLATFORM_UPDATE_EVENT, { detail: registration }));
}

export async function registerMddServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  const base = import.meta.env.BASE_URL || "./";
  const registration = await navigator.serviceWorker.register(`${base}sw.js`, {
    scope: base,
    updateViaCache: "none",
  });

  if (registration.waiting && navigator.serviceWorker.controller) announceUpdate(registration);

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) announceUpdate(registration);
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) window.location.reload();
  });

  const updateWhenVisible = () => {
    if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
  };
  document.addEventListener("visibilitychange", updateWhenVisible);
  window.addEventListener("online", updateWhenVisible);

  return registration;
}

export async function activateWaitingServiceWorker(registration?: ServiceWorkerRegistration | null): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const target = registration ?? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL || "./");
  if (!target?.waiting) return false;
  reloadForUpdate = true;
  target.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
