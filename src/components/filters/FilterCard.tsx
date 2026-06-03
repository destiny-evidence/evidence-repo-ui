import type { ComponentChildren } from "preact";
import { useId, useState } from "preact/hooks";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/shared/icons";
import "./FilterCard.css";

interface FilterCardProps {
  title: string;
  summary?: string;
  defaultExpanded?: boolean;
  children: ComponentChildren;
}

export function FilterCard({ title, summary, defaultExpanded = false, children }: FilterCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const showSummary = !!summary;

  return (
    <div class="filter-card">
      <button
        class="filter-card__header"
        type="button"
        onClick={() => setExpanded(!expanded)}
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
