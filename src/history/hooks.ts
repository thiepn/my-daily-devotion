import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { loadBibleManifest } from '../scripture/loader';
import type { BibleManifest } from '../scripture/types';

export function useHistoryLoad<T>(key: string, read: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key, data: null, error: '' });
  const [attempt, setAttempt] = useState(0), reader = useRef(read); reader.current = read;
  useEffect(() => {
    let active = true;
    const subscription = liveQuery(() => reader.current()).subscribe({ next: data => { if (active) setState({ key, data, error: '' }); }, error: () => { if (active) setState(old => ({ key, data: old.key === key ? old.data : null, error: 'Could not open this history. Your saved records are unchanged.' })); } });
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(n => n + 1); };
    window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [key, attempt]);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : '', retry: () => setAttempt(n => n + 1) };
}
const positions = new Map<string, { y: number; focus: string }>();
export function rememberHistoryPosition(url: string) { positions.set(url, { y: window.scrollY, focus: document.activeElement?.id ?? '' }); }
export function useHistoryPosition(url: string, ready: boolean, entry?: string) {
  const restored = useRef('');
  useEffect(() => {
    let position = positions.get(url) ?? { y: 0, focus: '' };
    const rememberScroll = () => { position = { ...position, y: window.scrollY }; };
    const rememberFocus = (event: FocusEvent) => { const target = event.target instanceof HTMLElement ? event.target : null; if (target?.id && target.closest('.grace-history')) position = { y: window.scrollY, focus: target.id }; };
    // Safari does not focus links on pointer activation, so remember that origin explicitly.
    const rememberPointer = (event: PointerEvent) => { const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[id]') : null; if (target) position = { y: window.scrollY, focus: target.id }; };
    window.addEventListener('scroll', rememberScroll); document.addEventListener('focusin', rememberFocus); document.addEventListener('pointerdown', rememberPointer);
    return () => { positions.set(url, position); if (positions.size > 60) positions.delete(positions.keys().next().value!); window.removeEventListener('scroll', rememberScroll); document.removeEventListener('focusin', rememberFocus); document.removeEventListener('pointerdown', rememberPointer); restored.current = ''; };
  }, [url]);
  useEffect(() => {
    if (!ready || restored.current === url) return;
    const frame = requestAnimationFrame(() => {
      const saved = positions.get(url), target = document.getElementById(saved?.focus || (entry ? `history-entry-${entry}` : ''));
      target?.focus({ preventScroll: true });
      if (saved) window.scrollTo({ top: saved.y, behavior: 'instant' }); else if (target) target.scrollIntoView({ block: 'center', behavior: 'instant' }); else window.scrollTo({ top: 0, behavior: 'instant' });
      restored.current = url;
    });
    return () => cancelAnimationFrame(frame);
  }, [url, ready, entry]);
}
export function useHistoryManifest() {
  const [manifest, setManifest] = useState<BibleManifest | null>(null);
  useEffect(() => { let active = true; void loadBibleManifest().then(value => { if (active) setManifest(value); }).catch(() => {}); return () => { active = false; }; }, []);
  return manifest;
}
