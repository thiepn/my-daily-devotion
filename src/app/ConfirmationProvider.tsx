import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface ConfirmationOptions {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

interface PendingConfirmation {
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
}

const ConfirmationContext = createContext<((options: ConfirmationOptions) => Promise<boolean>) | null>(null);

function ConfirmationDialog({ pending, finish }: { pending: PendingConfirmation; finish: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);

  const { options } = pending;
  return (
    <dialog
      ref={ref}
      className={`app-confirm-dialog${options.tone === "danger" ? " is-danger" : ""}`}
      aria-labelledby="app-confirm-title"
      aria-describedby="app-confirm-description"
      onCancel={(event) => { event.preventDefault(); finish(false); }}
    >
      <div className="app-confirm-copy">
        <h2 id="app-confirm-title">{options.title}</h2>
        <p id="app-confirm-description">{options.description}</p>
      </div>
      <div className="app-confirm-actions">
        <button className="app-confirm-cancel" type="button" autoFocus onClick={() => finish(false)}>
          {options.cancelLabel ?? "Cancel"}
        </button>
        <button className="app-confirm-accept" type="button" onClick={() => finish(true)}>
          {options.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const pendingRef = useRef<PendingConfirmation | null>(null);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    if (pendingRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const request = { options, resolve };
      pendingRef.current = request;
      setPending(request);
    });
  }, []);

  const finish = useCallback((confirmed: boolean) => {
    const request = pendingRef.current;
    if (!request) return;
    pendingRef.current = null;
    setPending(null);
    request.resolve(confirmed);
  }, []);

  useEffect(() => () => {
    const request = pendingRef.current;
    pendingRef.current = null;
    request?.resolve(false);
  }, []);

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {pending ? <ConfirmationDialog pending={pending} finish={finish} /> : null}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error("useConfirmation must be used within ConfirmationProvider.");
  return confirm;
}
