import { useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { JournalDialog } from "./JournalPrimitives";
import { useUpdateProtection } from "../app/useUpdateProtection";

/** Route transitions and reload warnings only: this is not durable draft storage. */
export function useWritingGuard(dirty: boolean, save: () => Promise<void>, canSave: boolean, savedDestination?: (target: string) => string, discard?: () => void | Promise<void>) {
  useUpdateProtection(dirty);
  const navigate = useNavigate();
  const bypass = useRef(false);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !bypass.current &&
    (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => { if (!dirty) bypass.current = false; }, [dirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty && !bypass.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { if (blocker.state !== "blocked") setError(""); }, [blocker.state]);
  const close = () => { if (!lock.current && blocker.state === "blocked") blocker.reset(); };
  return {
    allowNavigation: () => { bypass.current = true; },
    dialog: blocker.state === "blocked" ? <JournalDialog title="Keep your unsaved changes?" close={close} busy={busy}>
      <p>Save before continuing, discard these changes, or keep writing.</p>
      {error ? <p role="alert">{error}</p> : null}
      <div className="journal-dialog-actions">
        <button className="grace-primary" disabled={busy || !canSave} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true); setError("");
          try {
            await save();
            const target = blocker.location.pathname + blocker.location.search;
            const destination = savedDestination?.(target) ?? target;
            if (destination === target) blocker.proceed();
            else { blocker.reset(); bypass.current = true; navigate(destination); }
          }
          catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save. Your writing is still here."); }
          finally { lock.current = false; setBusy(false); }
        }}>{busy ? "Saving…" : "Save and continue"}</button>
        <button disabled={busy} onClick={async () => {
          if (lock.current) return;
          lock.current = true; setBusy(true); setError("");
          try { await discard?.(); blocker.proceed(); }
          catch (reason) { setError(reason instanceof Error ? reason.message : "Could not discard. Keep this page open and retry."); }
          finally { lock.current = false; setBusy(false); }
        }}>Discard and continue</button>
        <button disabled={busy} data-initial-focus onClick={close}>Keep editing</button>
      </div>
    </JournalDialog> : null,
  };
}
