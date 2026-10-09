import { useEffect, useState, useSyncExternalStore } from "react";
import { isUpdateProtected, subscribeUpdateProtection } from "./update-protection";
import { DATABASE_CONNECTION_EVENT } from "../data/lifecycle";
import { activateWaitingServiceWorker, inspectStorage, PLATFORM_UPDATE_EVENT } from "./platform";
import { classifyStoragePressure, STORAGE_WRITE_FAILURE_EVENT } from "./storage-pressure";

export function PlatformStatus() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const [databaseConnection, setDatabaseConnection] = useState<"ready" | "blocked" | "closed-for-upgrade">("ready");
  const [estimatedStoragePressure, setEstimatedStoragePressure] = useState(false);
  const [quotaWriteFailure, setQuotaWriteFailure] = useState(false);
  const protectedWriting = useSyncExternalStore(subscribeUpdateProtection, isUpdateProtected, () => false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const updateReady = (event: Event) => {
      const detail = (event as CustomEvent<ServiceWorkerRegistration>).detail;
      if (detail) setRegistration(detail);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener(PLATFORM_UPDATE_EVENT, updateReady);
    const databaseChanged = (event: Event) => {
      const state = (event as CustomEvent<string>).detail;
      if (state === "ready" || state === "blocked" || state === "closed-for-upgrade") setDatabaseConnection(state);
    };
    let active = true;
    const checkStorage = () => {
      if (document.visibilityState === "hidden") return;
      void inspectStorage(false).then(estimate => {
        if (active) setEstimatedStoragePressure(classifyStoragePressure(estimate.usage, estimate.quota) === "high");
      }).catch(() => { /* Unsupported/unreliable estimates must not make the app unusable. */ });
    };
    const onVisibility = () => { if (document.visibilityState === "visible") checkStorage(); };
    const onQuotaFailure = () => setQuotaWriteFailure(true);
    window.addEventListener(DATABASE_CONNECTION_EVENT, databaseChanged);
    window.addEventListener(STORAGE_WRITE_FAILURE_EVENT, onQuotaFailure);
    window.addEventListener("pageshow", checkStorage);
    window.addEventListener("focus", checkStorage);
    document.addEventListener("visibilitychange", onVisibility);
    checkStorage();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(PLATFORM_UPDATE_EVENT, updateReady);
      active = false;
      window.removeEventListener(DATABASE_CONNECTION_EVENT, databaseChanged);
      window.removeEventListener(STORAGE_WRITE_FAILURE_EVENT, onQuotaFailure);
      window.removeEventListener("pageshow", checkStorage);
      window.removeEventListener("focus", checkStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (online && !registration && databaseConnection === "ready" && !estimatedStoragePressure && !quotaWriteFailure) return null;

  return (
    <div className={`platform-status${!online ? " is-offline" : ""}${registration ? " has-update" : ""}`} role="status" aria-live="polite" aria-atomic="true">
      {!online ? <span><strong>Offline.</strong> Cached Scripture and local devotional data remain available.</span> : null}
      {databaseConnection === "blocked" ? <span><strong>Another tab is blocking a storage update.</strong> Save or copy any unsaved writing in the older MDD tab, then close it. Do not clear site data.</span> : null}
      {databaseConnection === "closed-for-upgrade" ? <span><strong>Another tab updated local storage.</strong> Keep this page open and copy any unsaved writing before reloading. Saved records have not been cleared.<button type="button" disabled={protectedWriting} onClick={() => window.location.reload()}>Reload when ready</button></span> : null}
      {estimatedStoragePressure ? <span><strong>Browser storage is nearly full (estimate).</strong> Other apps on this origin may share this quota. Once writing is safely saved, make an external backup from Data and privacy. Do not clear MDD site data.</span> : null}
      {quotaWriteFailure ? <span><strong>Local draft storage reported a full quota.</strong> Keep unsaved writing open and review the editor warning. After saving safely, export an external backup; do not clear site data.</span> : null}
      {registration ? (
        <span>
          <strong>Update ready.</strong> Your local data is preserved.
          <button
            type="button"
            disabled={updating || protectedWriting}
            onClick={() => {
              setUpdating(true);
              void activateWaitingServiceWorker(registration).then((activated) => {
                if (!activated) setUpdating(false);
              });
            }}
          >
            {updating ? "Updating…" : "Reload to update"}
          </button>
          {protectedWriting ? <small>Save or explicitly discard your writing before updating.</small> : null}
        </span>
      ) : null}
    </div>
  );
}
