import { useCallback, useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../data/database";
import { PrayerSessionRepository, PrayerSessionUnavailableError, type PrayerSessionState } from "../data/repositories/prayer-sessions";

const repository = new PrayerSessionRepository(db);
const unavailable = (error: unknown) => error instanceof PrayerSessionUnavailableError;

/** Only initial explicit entry reconciles; later reads and retries are readonly. */
export function useSessionState(sessionId: string) {
  const [data, setData] = useState<PrayerSessionState | null>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const entered = useRef(false), generation = useRef(0);

  useEffect(() => {
    const version = ++generation.current;
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;
    const current = () => active && version === generation.current;
    const failed = (reason: unknown) => {
      if (!current()) return;
      if (unavailable(reason)) { setData(null); setError(""); }
      else setError(entered.current ? "Could not refresh your session. Your recorded actions are still saved." : "Could not open your prayer session. Please try again.");
    };
    const subscribe = () => {
      subscription = liveQuery(() => repository.readState(sessionId)).subscribe({
        next: state => { if (current()) { setData(state); setError(""); } },
        error: failed,
      });
    };
    setError("");
    if (entered.current) subscribe();
    else void repository.loadState(sessionId).then(state => {
      if (!current()) return;
      entered.current = true; setData(state); subscribe();
    }).catch(failed);
    const refresh = () => { if (document.visibilityState === "visible") setAttempt(value => value + 1); };
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false; subscription?.unsubscribe();
      window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh);
    };
  }, [sessionId, attempt]);

  const accept = useCallback((state: PrayerSessionState) => {
    // An older subscription result cannot replace a just-committed mutation.
    generation.current += 1;
    entered.current = true; setData(state); setError(""); setAttempt(value => value + 1);
  }, []);
  return { data, error, accept, retry: () => setAttempt(value => value + 1) };
}
