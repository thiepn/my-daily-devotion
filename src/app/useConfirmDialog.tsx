import { useEffect, useRef, useState } from "react";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

function ConfirmDialog({
  options,
  finish,
}: {
  options: ConfirmDialogOptions;
  finish: (confirmed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`draft-dialog confirm-dialog${options.danger ? " is-danger" : ""}`}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
    >
      <h2 id="confirm-dialog-title">{options.title}</h2>
      <p id="confirm-dialog-description">{options.message}</p>
      <div className="draft-dialog-actions confirm-dialog-actions">
        <button
          className="confirm-dialog-cancel draft-dialog-keep"
          type="button"
          autoFocus
          onClick={() => finish(false)}
        >
          {options.cancelLabel ?? "Cancel"}
        </button>
        <button
          className="confirm-dialog-confirm"
          type="button"
          onClick={() => finish(true)}
        >
          {options.confirmLabel ?? "Continue"}
        </button>
      </div>
    </dialog>
  );
}

export function useConfirmDialog() {
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);

  useEffect(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);

  const finish = (confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setOptions(null);
    resolve?.(confirmed);
  };

  const confirm = (next: ConfirmDialogOptions): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setOptions(next);
    });
  };

  return {
    confirm,
    confirmDialog: options ? <ConfirmDialog options={options} finish={finish} /> : null,
  };
}
