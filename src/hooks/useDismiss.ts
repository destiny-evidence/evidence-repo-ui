import { useEffect } from "preact/hooks";
import type { RefObject } from "preact";

/**
 * Closes an open menu on a click outside `containerRef` or on Escape, which
 * also hands focus back to `triggerRef`.
 */
export function useDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
  containerRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen, containerRef, triggerRef]);
}
