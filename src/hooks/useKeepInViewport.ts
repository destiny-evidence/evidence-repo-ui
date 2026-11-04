import type { RefObject } from "preact";
import { useLayoutEffect } from "preact/hooks";

const MARGIN = 16; // px kept clear of the viewport's edges

/**
 * Shifts a left-anchored popover back inside the viewport when opening it
 * would run off the right edge, without pushing it past the left edge.
 */
export function useKeepInViewport(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
) {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    panel.style.left = "";
    const rect = panel.getBoundingClientRect();
    const overflow =
      rect.right - (document.documentElement.clientWidth - MARGIN);
    const shift = Math.min(overflow, rect.left - MARGIN);
    if (shift > 0) panel.style.left = `${-shift}px`;
  }, [open, panelRef]);
}
