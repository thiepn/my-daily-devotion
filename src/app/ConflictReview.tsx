import { useEffect, useState } from "react";

/** Reviewing never replaces a draft. Replacement requires the explicit button. */
export function ConflictReview<T>({ active, draftText, loadLatest, describe, useLatest }: {
  active: boolean; draftText: string; loadLatest: () => Promise<T>; describe: (record: T) => string; useLatest: (record: T) => void;
}) {
  const [latest, setLatest] = useState<{ record: T } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!active) { setLatest(null); setError(""); } }, [active]);
  if (!active) return null;
  return <section className="conflict-review" aria-label="Edit conflict" aria-busy={busy}>
    <p>Your draft has not been overwritten. Compare it with the saved version before replacing either one.</p>
    <button className="conflict-review-open" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { setLatest({ record: await loadLatest() }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not open the saved version."); } finally { setBusy(false); } }}>Review latest saved version</button>
    {error ? <p role="alert">{error}</p> : null}
    {latest ? <><label>Your unsaved draft<textarea readOnly value={draftText} /></label><label>Latest saved version<textarea readOnly value={describe(latest.record)} /></label><div className="conflict-review-actions"><button className="conflict-review-use" type="button" onClick={() => { useLatest(latest.record); setLatest(null); }}>Use saved version</button><button className="conflict-review-keep" type="button" onClick={() => setLatest(null)}>Keep my draft</button></div></> : null}
  </section>;
}
