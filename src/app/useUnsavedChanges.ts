import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { useConfirmation } from "./ConfirmationProvider";

/** Guard both SPA history and browser reloads without creating saved records. */
export function useUnsavedChanges(dirty: boolean): () => void {
  const allow = useRef(false);
  const asking = useRef(false);
  const confirm = useConfirmation();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allow.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));

  useEffect(() => { allow.current = false; }, [dirty]);

  useEffect(() => {
    if (blocker.state !== "blocked" || asking.current) return;
    asking.current = true;
    void confirm({
      title: "Leave without saving?",
      description: "Your unsaved changes will stay on this screen unless you choose to leave.",
      confirmLabel: "Leave without saving",
      cancelLabel: "Keep editing",
      tone: "danger",
    }).then((leave) => {
      asking.current = false;
      if (leave) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!allow.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  return () => { allow.current = true; };
}
