import { useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";

/** Read subscriptions never seed metadata or replace a just-committed result. */
export function useMetadataRead<T>(key: string, read: () => Promise<T>) {
  const reader = useRef(read); reader.current = read;
  const generation = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | undefined; error: string }>({ key, data: undefined, error: "" });
  useEffect(() => {
    const version = ++generation.current;
    let alive = true;
    const subscription = liveQuery(() => reader.current()).subscribe({
      next: data => { if (alive && version === generation.current) setState({ key, data, error: "" }); },
      error: () => { if (alive && version === generation.current) setState(old => ({ key, data: old.key === key ? old.data : undefined, error: "These saved details could not be refreshed." })); },
    });
    const refresh = () => { if (document.visibilityState === "visible") setAttempt(value => value + 1); };
    window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; subscription.unsubscribe(); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [key, attempt]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : "",
    retry: () => setAttempt(value => value + 1),
    accept: (change: (old: T | undefined) => T) => {
      generation.current++;
      setState(old => ({ key, data: change(old.key === key ? old.data : undefined), error: "" }));
      setAttempt(value => value + 1);
    } };
}
