import { useEffect, useState } from "react";

export function keyboardOccludesEditor({
  compact, editing, fullHeight, visibleHeight, scale,
}: { compact: boolean; editing: boolean; fullHeight: number; visibleHeight: number; scale: number }): boolean {
  return compact && editing && scale <= 1.05 &&
    Number.isFinite(fullHeight) && Number.isFinite(visibleHeight) &&
    fullHeight - visibleHeight >= 140;
}

function isTextEditor(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled &&
      !["button", "checkbox", "radio", "submit", "reset", "file", "hidden", "range", "color", "image"].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * Mobile browsers expose a smaller visual viewport when their software
 * keyboard opens. Keep the fixed tab bar from covering focused text entry;
 * don't hide navigation for a hardware keyboard or harmless focus alone.
 */
export function useMobileKeyboard(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    let frame = 0;
    let width = window.innerWidth;
    let fullHeight = viewport?.height ?? window.innerHeight;

    const refresh = () => {
      const height = viewport?.height ?? window.innerHeight;
      if (width !== window.innerWidth) {
        width = window.innerWidth;
        fullHeight = height; // A rotation/new width establishes a new baseline.
      }
      const editing = isTextEditor(document.activeElement);
      if (!editing) fullHeight = Math.max(fullHeight, height);
      const compact = window.matchMedia("(max-width: 760px), (max-height: 500px) and (max-width: 900px)").matches;
      setVisible(keyboardOccludesEditor({
        compact, editing, fullHeight, visibleHeight: height, scale: viewport?.scale ?? 1,
      }));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    window.addEventListener("resize", schedule);
    viewport?.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
    };
  }, []);
  return visible;
}
