import { useEffect, useState, useSyncExternalStore } from "react";
import type { MddDatabase } from "../data/database";
import type { DraftContext, DraftPayload } from "./types";
import { DurableDraftController } from "./controller";

/** Payload and dirty/baseline ownership remain in the editor. No domain save,
 * focus change or selection update is performed by background persistence. */
export function useDurableDraft(database: MddDatabase, context: DraftContext, payload: DraftPayload | null, dirty: boolean) {
  const [controller] = useState(() => new DurableDraftController(database, context));
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const serialized = JSON.stringify(payload);
  const serializedContext = JSON.stringify(context);
  useEffect(() => {
    controller.attach();
    const hidden = () => { if (document.visibilityState === "hidden") void controller.flush().catch(() => undefined); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); controller.detach(); };
  }, [controller]);
  useEffect(() => {
    controller.setContext(JSON.parse(serializedContext) as DraftContext);
    if (dirty && serialized !== "null") controller.stage(JSON.parse(serialized) as DraftPayload);
    // Returning exactly to baseline explicitly retires this editor's draft.
    else if (!dirty && state.status !== "idle") void controller.discard().catch(() => undefined);
  }, [controller, serialized, serializedContext, dirty]);
  return { controller, ...state, retry: () => controller.flush() };
}
