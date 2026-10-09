import { useSyncExternalStore } from 'react';

/** Artwork follows the applied theme, including restored preferences and OS changes.
 * One shared observer; reading appearance never reads or writes journal records. */
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;
function isDark(): boolean {
  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    const notify = () => listeners.forEach(callback => callback());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    media.addEventListener('change', notify);
    stop = () => { observer.disconnect(); media.removeEventListener('change', notify); };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { stop?.(); stop = undefined; }
  };
}
export function useEffectiveTheme() {
  return useSyncExternalStore(subscribe, isDark, () => false);
}
