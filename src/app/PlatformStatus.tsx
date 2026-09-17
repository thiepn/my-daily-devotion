import { useEffect, useState } from "react";
import { activateWaitingServiceWorker, PLATFORM_UPDATE_EVENT } from "./platform";

export function PlatformStatus() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updating, setUpdating] = useState(false);

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
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(PLATFORM_UPDATE_EVENT, updateReady);
    };
  }, []);

  if (online && !registration) return null;

  return (
    <div className="platform-status" role="status" aria-live="polite" aria-atomic="true">
      {!online ? <span><strong>Offline.</strong> Cached Scripture and local devotional data remain available.</span> : null}
      {registration ? (
        <span>
          <strong>Update ready.</strong> Your local data is preserved.
          <button
            type="button"
            disabled={updating}
            onClick={() => {
              setUpdating(true);
              void activateWaitingServiceWorker(registration).then((activated) => {
                if (!activated) setUpdating(false);
              });
            }}
          >
            {updating ? "Updating…" : "Reload to update"}
          </button>
        </span>
      ) : null}
    </div>
  );
}
