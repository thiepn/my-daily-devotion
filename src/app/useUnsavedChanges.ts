import { useContext, useEffect, useRef } from "react";
import { UnsavedChangesContext } from "./UnsavedChangesProvider";

/** Register editor dirtiness with the app-level navigation guard. */
export function useUnsavedChanges(dirty: boolean): () => void {
  const controller = useContext(UnsavedChangesContext);
  const token = useRef(Symbol("unsaved-editor"));

  if (!controller) throw new Error("useUnsavedChanges must be used inside UnsavedChangesProvider.");

  useEffect(() => {
    const id = token.current;
    controller.setDirty(id, dirty);
    return () => controller.remove(id);
  }, [controller, dirty]);

  return controller.allowNextNavigation;
}
