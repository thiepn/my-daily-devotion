import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, useLocation } from "react-router-dom";

export interface UnsavedChangesController {
  setDirty: (token: symbol, dirty: boolean) => void;
  remove: (token: symbol) => void;
  allowNextNavigation: () => void;
}

export const UnsavedChangesContext = createContext<UnsavedChangesController | null>(null);

function NavigationDraftDialog({ leave, stay }: { leave: () => void; stay: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="draft-dialog navigation-draft-dialog"
      aria-labelledby="navigation-draft-title"
      onCancel={(event) => {
        event.preventDefault();
        stay();
      }}
    >
      <h2 id="navigation-draft-title">Leave without saving?</h2>
      <p>Your changes are still only in this editor. Stay here to keep working, or leave and discard them.</p>
      <div className="draft-dialog-actions navigation-draft-actions">
        <button className="draft-dialog-keep" type="button" autoFocus onClick={stay}>Keep editing</button>
        <button className="draft-dialog-discard" type="button" onClick={leave}>Leave without saving</button>
      </div>
    </dialog>
  );
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirtyTokens, setDirtyTokens] = useState<Set<symbol>>(() => new Set());
  const allow = useRef(false);
  const location = useLocation();
  const dirty = dirtyTokens.size > 0;

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty
    && !allow.current
    && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  const setDirty = useCallback((token: symbol, nextDirty: boolean) => {
    setDirtyTokens((current) => {
      const has = current.has(token);
      if (has === nextDirty) return current;
      const next = new Set(current);
      if (nextDirty) next.add(token);
      else next.delete(token);
      return next;
    });
  }, []);

  const remove = useCallback((token: symbol) => {
    setDirtyTokens((current) => {
      if (!current.has(token)) return current;
      const next = new Set(current);
      next.delete(token);
      return next;
    });
  }, []);

  const allowNextNavigation = useCallback(() => {
    allow.current = true;
  }, []);

  useEffect(() => {
    allow.current = false;
  }, [location.key]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allow.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const value = useMemo(
    () => ({ setDirty, remove, allowNextNavigation }),
    [allowNextNavigation, remove, setDirty],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {blocker.state === "blocked" ? (
        <NavigationDraftDialog
          stay={() => blocker.reset()}
          leave={() => {
            allow.current = true;
            blocker.proceed();
          }}
        />
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}
