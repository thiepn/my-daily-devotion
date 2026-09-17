import { useEffect, useState } from "react";
import { currentTimeZone, todayLocalDate } from "../domain/time";

const snapshot = () => ({ localDate: todayLocalDate(), timeZone: currentTimeZone() });
/** Civil midnight and foreground/timezone changes refresh dated views, never editors. */
export function useLocalClock() {
  const [clock, setClock] = useState(snapshot);
  useEffect(() => {
    const check = () => { const next = snapshot(); setClock((old) => old.localDate === next.localDate && old.timeZone === next.timeZone ? old : next); };
    const now = new Date(); const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(check, Math.max(1, midnight.getTime() - now.getTime() + 25));
    const interval = window.setInterval(check, 60_000);
    window.addEventListener("focus", check); window.addEventListener("pageshow", check); document.addEventListener("visibilitychange", check);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); window.removeEventListener("focus", check); window.removeEventListener("pageshow", check); document.removeEventListener("visibilitychange", check); };
  }, [clock.localDate, clock.timeZone]);
  return clock;
}
