import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

/** Guard both SPA history and browser reloads without creating saved records. */
export function useUnsavedChanges(dirty: boolean): () => void {
  const allow = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !allow.current && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => { allow.current = false; }, [dirty]);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Leave without saving your changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!allow.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  return () => { allow.current = true; };
}
