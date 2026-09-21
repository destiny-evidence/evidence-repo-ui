import type { ComponentChildren } from "preact";
import type { AnalyticsEvent } from "@/analytics/events";
import { track } from "@/analytics/matomo";
import { NewTabLinkIcon } from "@/components/common/icons";
import "./NewTabLink.css";

interface NewTabLinkProps {
  href: string;
  /** Layout classes for the anchor; this component styles only the glyph. */
  class?: string;
  /** Matomo event fired on click. */
  event?: AnalyticsEvent;
  /**
   * Replace the default NewTabLinkIcon, or `false` to drop it.
   */
  icon?: ComponentChildren;
  "aria-label"?: string;
  children: ComponentChildren;
}

/**
 * An anchor that opens in a new tab, with the ↗ glyph after its children.
 *
 * Spacing before the glyph comes from the caller's own `gap`.
 */
export function NewTabLink({
  href,
  class: className,
  event,
  icon = <NewTabLinkIcon />,
  "aria-label": ariaLabel,
  children,
}: NewTabLinkProps) {
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
      {icon && (
        <span class="new-tab-link__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </a>
  );
}
