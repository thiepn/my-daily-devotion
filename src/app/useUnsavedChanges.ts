import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { useConfirmDialog } from "./useConfirmDialog";

/** Guard both SPA history and browser reloads without creating saved records. */
export function useUnsavedChanges(dirty: boolean): () => void {
  const allow = useRef(false);
  const confirm = useConfirmDialog();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allow.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));

  useEffect(() => { allow.current = false; }, [dirty]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let active = true;
    void confirm({
      title: "Leave without saving?",
      message: "Your unsaved changes will be discarded if you leave this screen.",
      confirmLabel: "Leave without saving",
      cancelLabel: "Keep editing",
      tone: "danger",
    }).then((leave) => {
      if (!active || blocker.state !== "blocked") return;
      if (leave) blocker.proceed();
      else blocker.reset();
    });
    return () => { active = false; };
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!allow.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  return () => { allow.current = true; };
}
