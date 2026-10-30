import type { ComponentChildren } from "preact";
import "./BackLink.css";

interface BackLinkProps {
  href: string;
  class?: string;
  onClick?: (event: MouseEvent) => void;
  children: ComponentChildren;
}

export function BackLink({
  href,
  class: className,
  onClick,
  children,
}: BackLinkProps) {
  return (
    <a
      class={className ? `back-link ${className}` : "back-link"}
      href={href}
      onClick={onClick}
    >
      <span class="back-link__arrow" aria-hidden="true">
        ←
      </span>
      {children}
    </a>
  );
}
