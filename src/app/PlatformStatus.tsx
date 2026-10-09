import { useEffect, useState, useSyncExternalStore } from "react";
import { isUpdateProtected, subscribeUpdateProtection } from "./update-protection";
import { DATABASE_CONNECTION_EVENT } from "../data/lifecycle";
import { activateWaitingServiceWorker, PLATFORM_UPDATE_EVENT } from "./platform";

export function PlatformStatus() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);
  const [databaseConnection, setDatabaseConnection] = useState<"ready" | "blocked" | "closed-for-upgrade">("ready");
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
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "ready" || detail === "blocked" || detail === "closed-for-upgrade") setDatabaseConnection(detail);
    };
    window.addEventListener(DATABASE_CONNECTION_EVENT, databaseChanged);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(PLATFORM_UPDATE_EVENT, updateReady);
      window.removeEventListener(DATABASE_CONNECTION_EVENT, databaseChanged);
    };
  }, []);

  if (online && !registration && databaseConnection === "ready") return null;

  return (
    <div className={`platform-status${!online ? " is-offline" : ""}${registration ? " has-update" : ""}`} role="status" aria-live="polite" aria-atomic="true">
      {!online ? <span><strong>Offline.</strong> Cached Scripture and local devotional data remain available.</span> : null}
      {databaseConnection === "blocked" ? <span><strong>Another tab is blocking a storage update.</strong> Finish any writing in the other MDD tab, then close it. Keep this page open; do not clear site data. The update can resume when the other connection closes.</span> : null}
      {databaseConnection === "closed-for-upgrade" ? <span><strong>Another tab updated local storage.</strong> Keep this page open and copy any unsaved writing before reloading. Saved records have not been cleared.<button type="button" disabled={protectedWriting} onClick={() => window.location.reload()}>Reload when ready</button></span> : null}
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
