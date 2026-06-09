import type { ComponentChildren } from "preact";
import { useId, useRef, useState } from "preact/hooks";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/common/icons";
import "./FilterCard.css";

interface FilterCardProps {
  title: string;
  summary?: string;
  defaultExpanded?: boolean;
  children: ComponentChildren;
}

export function FilterCard({ title, summary, defaultExpanded = false, children }: FilterCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const showSummary = !!summary;

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    // When opening, reveal the freshly-shown content if it sits below the fold
    // of a scrollable container (the map config panel / the drawer body). Wait
    // a frame so the panel has expanded before measuring; block:"nearest" keeps
    // the move minimal and the header in view.
    if (next) {
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  return (
    <div class="filter-card" ref={cardRef}>
      <button
        class="filter-card__header"
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span class="filter-card__title">{title}</span>
        {showSummary && (
          <span class="filter-card__summary">{summary}</span>
        )}
        <span class="filter-card__arrow" aria-hidden="true">
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      <div id={panelId} class="filter-card__panel" hidden={!expanded}>
        {children}
      </div>
    </div>
  );
}
