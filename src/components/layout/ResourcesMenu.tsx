import { useEffect, useId, useRef, useState } from "preact/hooks";
import { ChevronDownIcon, ExternalLinkIcon } from "@/components/icons";
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

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div class="app-nav__item" ref={containerRef}>
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
          <a
            key={r.href}
            class="resource-link"
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="resource-link__body">
              <span class="resource-link__title">
                {r.title}
                <span class="resource-link__ext" aria-hidden="true">
                  <ExternalLinkIcon size={11} />
                </span>
              </span>
              <span class="resource-link__desc">{r.description}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
