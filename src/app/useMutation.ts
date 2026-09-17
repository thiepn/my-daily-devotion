import { useRef, useState } from "react";

/** One mutation at a time, with a visible recoverable error rather than a rejected click promise. */
export function useMutation() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setStatus(""); setFailed(false);
    try { await action(); return true; }
    catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : "Could not save this change. Your draft is still available; please try again."); return false; }
    finally { locked.current = false; setBusy(false); }
  };
  return { busy, status, failed, setStatus, run };
}
