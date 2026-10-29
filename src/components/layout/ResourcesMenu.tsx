import { useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { NewTabLink } from "@/components/common/NewTabLink";
import { ChevronDownIcon } from "@/components/common/icons";
import type { ExternalResource } from "@/types/models";
import "./ResourcesMenu.css";

interface ResourcesMenuProps {
  resources: ExternalResource[];
}

export function ResourcesMenu({ resources }: ResourcesMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const buttonId = useId();
  const panelId = useId();

  useDismiss(open, setOpen, containerRef, buttonRef);

  return (
    <div class="app-nav__item app-nav__resources" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        class="app-nav__link"
        id={buttonId}
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        Resources
        <span class={`app-nav__caret${open ? " app-nav__caret--open" : ""}`} aria-hidden="true">
          <ChevronDownIcon size={12} />
        </span>
      </button>
      <div
        class={`resources-menu${open ? " resources-menu--anim" : ""}`}
        id={panelId}
        hidden={!open}
      >
        {resources.map((r) => (
          <NewTabLink
            key={r.href}
            class="resource-link"
            href={r.href}
            event={{ category: "Resources", action: "Link Clicked", name: r.title }}
          >
            <span class="resource-link__body">
              <span class="resource-link__title">{r.title}</span>
              <span class="resource-link__desc">{r.description}</span>
            </span>
          </NewTabLink>
        ))}
      </div>
    </div>
  );
}
