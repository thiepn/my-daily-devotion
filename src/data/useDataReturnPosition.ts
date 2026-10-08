import { useEffect } from "react";

interface DataReturnPosition { url: string; y: number; id: string; href: string | null; }
let origin: DataReturnPosition | null = null;
let checkOrigin: DataReturnPosition | null = null;
export function clearDataReturnPosition() { origin = null; checkOrigin = null; }

/** Only UI position is remembered; backup inputs and records never enter this map. */
export function useDataReturnPosition(url: string) {
  useEffect(() => {
    const remember = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (target && new URL(target.href).hash.startsWith('#/data/check') && /^\/data(?:\?|$)/.test(url)) {
        checkOrigin = { url, y: window.scrollY, id: target.id, href: target.getAttribute('href') }; return;
      }
      if (!target || !new URL(target.href).hash.startsWith("#/data") || url.startsWith("/data")) return;
      origin = { url, y: window.scrollY, id: target.id, href: target.getAttribute("href") };
    };
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, [url]);
  useEffect(() => {
    const nested = checkOrigin?.url === url;
    const saved = nested ? checkOrigin : origin;
    if (!saved || saved.url !== url) return;
    let frame = 0;
    const restore = () => {
      if (document.querySelector('.route-loading') || !nested && document.querySelector('.data-journal') || !document.querySelector('#main-content main')) return;
      const target = (saved.id ? document.getElementById(saved.id) : null) ?? [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].find(link => link.getAttribute("href") === saved.href && link.getClientRects().length > 0);
      if (!target) return;
      if (nested) { let parent = target.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; } }
      observer.disconnect(); if (nested) checkOrigin = null; else origin = null;
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { target.focus({ preventScroll: true }); window.scrollTo({ top: saved.y, behavior: "instant" }); }); });
    };
    const observer = new MutationObserver(restore);
    observer.observe(document.getElementById("main-content") ?? document.body, { childList: true, subtree: true });
    restore();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [url]);
}
