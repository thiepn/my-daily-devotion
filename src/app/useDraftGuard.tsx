import { useEffect, useRef, useState } from "react";

function DraftDialog({ save, discard, finish }: { save: (() => Promise<void>) | undefined; discard: () => void; finish: (proceed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  const saveAndContinue = async () => {
    if (!save || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { await save(); finish(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save. Your draft is still here."); }
    finally { locked.current = false; setBusy(false); }
  };
  return <dialog ref={ref} className="draft-dialog" aria-labelledby="draft-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) finish(false); }}>
    <h2 id="draft-dialog-title">Keep your unsaved changes?</h2>
    <p>{save ? "Save before continuing, discard the draft, or return to editing." : "This action would hide unsaved answer notes. Finish the answer first, or explicitly discard the draft."}</p>
    {error ? <p role="alert">{error}</p> : null}
    <div className="draft-dialog-actions">
      {save ? <button type="button" disabled={busy} onClick={() => void saveAndContinue()}>{busy ? "Saving…" : "Save and continue"}</button> : null}
      <button type="button" disabled={busy} onClick={() => { discard(); finish(true); }}>Discard and continue</button>
      <button type="button" autoFocus disabled={busy} onClick={() => finish(false)}>Keep editing</button>
    </div>
  </dialog>;
}

/** Protect in-page selection and lifecycle changes, in addition to the route guard. */
export function useDraftGuard(dirty: boolean, save: (() => Promise<void>) | undefined, discard: () => void) {
  const pending = useRef<((proceed: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => { pending.current?.(false); pending.current = null; }, []);
  const confirmDrafts = (): Promise<boolean> => {
    if (!dirty) return Promise.resolve(true);
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => { pending.current = resolve; setOpen(true); });
  };
  const finish = (proceed: boolean) => { const resolve = pending.current; pending.current = null; setOpen(false); resolve?.(proceed); };
  return { confirmDrafts, draftDialog: open ? <DraftDialog save={save} discard={discard} finish={finish} /> : null };
}
