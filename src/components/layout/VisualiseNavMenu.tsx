import { useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { ChevronDownIcon } from "@/components/common/icons";
import "./ResourcesMenu.css";
import "./VisualiseNavMenu.css";

export interface VisualiseView {
  name: string;
  description: string;
  href: string;
}

interface VisualiseNavMenuProps {
  views: readonly VisualiseView[];
  active: boolean;
  pathname: string;
  onSelect: (view: VisualiseView) => void;
}

export function VisualiseNavMenu({
  views,
  active,
  pathname,
  onSelect,
}: VisualiseNavMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useDismiss(open, setOpen, containerRef, buttonRef);

  return (
    <>
      <div class="app-nav__item app-nav__visualise" ref={containerRef}>
        <button
          ref={buttonRef}
          type="button"
          class={`app-nav__link${active ? " active" : ""}`}
          aria-expanded={open ? "true" : "false"}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          Visualise
          <span
            class={`app-nav__caret${open ? " app-nav__caret--open" : ""}`}
            aria-hidden="true"
          >
            <ChevronDownIcon size={12} />
          </span>
        </button>
        <div
          class={`resources-menu visualise-nav-menu${open ? " resources-menu--anim" : ""}`}
          id={panelId}
          hidden={!open}
        >
          {views.map((view) => (
            <a
              key={view.href}
              class="resource-link"
              href={view.href}
              aria-current={view.href === pathname ? "page" : undefined}
              onClick={() => {
                setOpen(false);
                onSelect(view);
              }}
            >
              <span class="resource-link__body">
                <span class="resource-link__title">{view.name}</span>
                <span class="resource-link__desc">{view.description}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
      {/* Flat stand-in for the dropdown in the narrow-screen menu; CSS shows one or the other. */}
      <div class="app-nav__visualise-flat" role="group" aria-label="Visualise">
        {views.map((view) => (
          <a
            key={view.href}
            class={`app-nav__link${view.href === pathname ? " active" : ""}`}
            href={view.href}
            aria-current={view.href === pathname ? "page" : undefined}
            onClick={() => onSelect(view)}
          >
            {view.name}
          </a>
        ))}
      </div>
    </>
  );
}
