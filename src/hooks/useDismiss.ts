import { useEffect } from "preact/hooks";
import type { RefObject } from "preact";

/**
 * Closes an open menu on a click outside `containerRef` or on Escape, which
 * also hands focus back to `triggerRef`. Clicks that `ignore` accepts are left
 * for their own handlers.
 */
export function useDismiss(
  open: boolean,
  setOpen: (open: boolean) => void,
  containerRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLElement | SVGElement>,
  ignore?: (target: Node) => boolean,
): void {
  useEffect(() => {
    if (!open) return;
    // Checks the click's path rather than containment: the path is fixed when
    // the click happens, so a control that re-rendered itself away before the
    // click reached the document (e.g. a Clear button) still counts as inside.
    function onDocClick(e: MouseEvent) {
      const container = containerRef.current;
      if (container && e.composedPath().includes(container)) return;
      if (ignore?.(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen, containerRef, triggerRef, ignore]);
}
