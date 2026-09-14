import type { ComponentChildren } from "preact";
import type { AnalyticsEvent } from "@/analytics/events";
import { track } from "@/analytics/matomo";
import { ExternalLinkIcon } from "@/components/common/icons";
import "./ExternalLink.css";

interface ExternalLinkProps {
  href: string;
  /** Layout classes for the anchor; this component styles only the glyph. */
  class?: string;
  /** Matomo event fired on click. */
  event?: AnalyticsEvent;
  /** Size of the trailing ↗ glyph. */
  iconSize?: number;
  "aria-label"?: string;
  children: ComponentChildren;
}

/**
 * An anchor that opens in a new tab, with the ↗ glyph after its children.
 *
 * Spacing before the glyph comes from the caller's own `gap`.
 */
export function ExternalLink({
  href,
  class: className,
  event,
  iconSize = 11,
  "aria-label": ariaLabel,
  children,
}: ExternalLinkProps) {
  return (
    <a
      class={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={event ? () => track(event) : undefined}
    >
      {children}
      <span class="external-link__icon" aria-hidden="true">
        <ExternalLinkIcon size={iconSize} />
      </span>
    </a>
  );
}
