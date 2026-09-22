import { useEffect, useId, useRef, useState } from "react";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

function ConfirmDialog({ options, finish }: { options: ConfirmDialogOptions; finish: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);

  const tone = options.tone ?? "default";

  return (
    <dialog
      ref={ref}
      className="draft-dialog confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); finish(false); }}
    >
      <h2 id={titleId}>{options.title}</h2>
      <p>{options.message}</p>
      <div className="draft-dialog-actions confirm-dialog-actions">
        <button
          className={tone === "danger" ? "confirm-dialog-confirm confirm-dialog-danger" : "confirm-dialog-confirm draft-dialog-save"}
          type="button"
          onClick={() => finish(true)}
        >
          {options.confirmLabel ?? "Continue"}
        </button>
        <button className="draft-dialog-keep confirm-dialog-cancel" type="button" autoFocus onClick={() => finish(false)}>
          {options.cancelLabel ?? "Cancel"}
        </button>
      </div>
    </dialog>
  );
}

/** Native in-app confirmation flow used instead of browser confirm() chrome. */
export function useConfirmDialog() {
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);

  useEffect(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);

  const confirm = (next: ConfirmDialogOptions): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setOptions(next);
    });
  };

  const finish = (confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setOptions(null);
    resolve?.(confirmed);
  };

  return {
    confirm,
    confirmationDialog: options ? <ConfirmDialog options={options} finish={finish} /> : null,
  };
}
