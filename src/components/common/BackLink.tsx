import type { ComponentChildren } from "preact";
import { navigateWithState } from "@/services/navigation";
import "./BackLink.css";

interface BackLinkProps {
  href: string;
  class?: string;
  // history.state to restore on the page this links back to.
  state?: unknown;
  children: ComponentChildren;
}

export function BackLink({
  href,
  class: className,
  state,
  children,
}: BackLinkProps) {
  return (
    <a
      class={className ? `back-link ${className}` : "back-link"}
      href={href}
      onClick={
        state == null
          ? undefined
          : (event) => navigateWithState(event, href, state)
      }
    >
      <span class="back-link__arrow" aria-hidden="true">
        ←
      </span>
      {children}
    </a>
  );
}
