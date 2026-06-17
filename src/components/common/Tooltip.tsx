import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import "./Tooltip.css";

interface TooltipProps {
  /** When undefined or empty, the trigger renders without tooltip behavior. */
  text: string | undefined;
  children: ComponentChildren;
}

/**
 * Wrap a trigger element to show a hover/focus tooltip with the given text.
 * The trigger inside is responsible for its own cursor, tabIndex, and focus
 * outline; this component only provides the bubble.
 */
export function Tooltip({ text, children }: TooltipProps) {
  if (!text) return <>{children}</>;
  return <TooltipTrigger text={text}>{children}</TooltipTrigger>;
}

const GAP = 8; // px between the trigger and the bubble
const MARGIN = 8; // px the bubble keeps from the viewport edges

function TooltipTrigger({
  text,
  children,
}: {
  text: string;
  children: ComponentChildren;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  // showPopover() lifts the bubble into the top layer, where it escapes every
  // ancestor's overflow and stacking context (drawer/map scroll boxes) without
  // a portal. We position it by hand for universal support; unmounting on hide
  // clears the top layer, so no hidePopover() is needed.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const trigger = triggerRef.current;
    if (!shown || !bubble || !trigger) return;

    bubble.showPopover?.(); // absent in jsdom and pre-2024 engines

    const r = trigger.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = bubble;
    const centerX = r.left + r.width / 2;
    const half = w / 2;
    const left = Math.max(
      MARGIN + half,
      Math.min(centerX, window.innerWidth - MARGIN - half),
    );
    // Prefer above; flip below when it won't clear the viewport top.
    const above = r.top - GAP - h >= MARGIN;
    const top = above ? r.top - GAP - h : r.bottom + GAP;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.dataset.placement = above ? "above" : "below";
    // Keep the tail over the trigger when the bubble is clamped to the edge.
    bubble.style.setProperty("--tail-x", `${centerX - left}px`);
  }, [shown, text]);

  return (
    <span
      ref={triggerRef}
      class="tooltip"
      data-tooltip={text}
      onMouseEnter={() => setShown(true)}
      onMouseLeave={() => setShown(false)}
      onFocusCapture={() => setShown(true)}
      onBlurCapture={() => setShown(false)}
    >
      {children}
      {shown && (
        <div
          ref={bubbleRef}
          class="tooltip__bubble"
          popover="manual"
          aria-hidden="true"
        >
          {text}
        </div>
      )}
    </span>
  );
}
