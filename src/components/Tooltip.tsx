import type { ComponentChildren } from "preact";
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
  return (
    <span class="tooltip" data-tooltip={text}>
      {children}
    </span>
  );
}
