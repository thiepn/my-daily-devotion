import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MddDatabase } from "../data/database";
import type { DraftContext, DraftPayload } from "./types";
import { DurableDraftController } from "./controller";

/** Payload and dirty/baseline ownership remain in the editor. No domain save,
 * focus change or selection update is performed by background persistence. */
export function useDurableDraft(database: MddDatabase, context: DraftContext, payload: DraftPayload | null, dirty: boolean, ownerKey = "editor") {
  // An explicitly completed editor can hand off to a new owner without
  // discarding a commitment marker while queued input is still possible.
  const controller = useMemo(() => new DurableDraftController(database, context), [database, ownerKey]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const serialized = JSON.stringify(payload);
  const serializedContext = JSON.stringify(context);
  useEffect(() => {
    controller.attach();
    const hidden = () => { if (document.visibilityState === "hidden") void controller.flush().catch(() => undefined); };
    // pagehide/freeze can precede or replace visibilitychange on mobile PWAs.
    // These are best-effort flush opportunities, not a synchronous unload save.
    const pageHiding = () => { void controller.flush().catch(() => undefined); };
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("freeze", pageHiding);
    window.addEventListener("pagehide", pageHiding);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("freeze", pageHiding);
      window.removeEventListener("pagehide", pageHiding);
      controller.detach();
    };
  }, [controller]);
  useEffect(() => {
    controller.setContext(JSON.parse(serializedContext) as DraftContext);
    if (dirty && serialized !== "null") controller.stage(JSON.parse(serialized) as DraftPayload);
    // Returning exactly to baseline explicitly retires this editor's draft.
    else if (!dirty && state.status !== "idle") void controller.discard().catch(() => undefined);
  }, [controller, serialized, serializedContext, dirty]);
  return { controller, ...state, retry: () => controller.flush() };
}
