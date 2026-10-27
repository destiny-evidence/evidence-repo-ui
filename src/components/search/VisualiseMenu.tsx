import { useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { ChevronDownIcon } from "@/components/common/icons";
import { Tooltip } from "@/components/common/Tooltip";
import { MapAxisFields } from "@/components/visualise/MapAxisFields";
import { formatTotal } from "@/utils/searchTotal";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import type { EvidenceMapAxes, SearchResultTotal } from "@/types/models";
import "./ExportMenu.css";
import "./VisualiseMenu.css";

interface VisualiseMenuProps {
  total: SearchResultTotal;
  // A new search is loading, so `total` still belongs to the previous one.
  loading: boolean;
  // Whether a query or filters narrow the results, or it's the whole repository.
  scoped: boolean;
  countNoun: string;
  defaultAxes: EvidenceMapAxes;
  schemes: ConceptScheme[];
  includeCountries: boolean;
  onVisualise: (axes: EvidenceMapAxes) => void;
}

/**
 * Maps every result of the current search. Shares the Export menu's look; the
 * axes start on the community defaults.
 */
export function VisualiseMenu({
  total,
  loading,
  scoped,
  countNoun,
  defaultAxes,
  schemes,
  includeCountries,
  onVisualise,
}: VisualiseMenuProps) {
  const [open, setOpen] = useState(false);
  const [axes, setAxes] = useState(defaultAxes);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const disabled = loading || total.count === 0;

  useDismiss(open, setOpen, containerRef, buttonRef);

  return (
    <div class="export-menu" ref={containerRef}>
      <Tooltip
        text={!loading && total.count === 0 ? "No results to map" : undefined}
      >
        <button
          ref={buttonRef}
          type="button"
          class="export-button"
          aria-expanded={open ? "true" : "false"}
          aria-controls={panelId}
          aria-disabled={disabled ? "true" : undefined}
          onClick={disabled ? undefined : () => setOpen((v) => !v)}
        >
          Visualise
          <span
            class={`export-button__caret${open ? " is-open" : ""}`}
            aria-hidden="true"
          >
            <ChevronDownIcon size={12} />
          </span>
        </button>
      </Tooltip>

      {open && (
        <div
          class="export-menu__panel visualise-menu__panel"
          id={panelId}
          role="group"
          aria-label="Visualise as an evidence map"
        >
          <p class="export-menu__label">{countNoun} to map</p>
          <div class="export-menu__option is-disabled visualise-menu__scope">
            <span class="export-menu__option-name">
              {scoped
                ? "All results for this search"
                : `All ${countNoun} in the repository`}
              <span class="export-menu__option-reason">
                To map fewer, refine the search first.
              </span>
            </span>
            <span class="export-menu__ext">{formatTotal(total)}</span>
          </div>

          <p class="export-menu__label">Configure map</p>
          <div class="visualise-menu__axes">
            <MapAxisFields
              axes={axes}
              schemes={schemes}
              includeCountries={includeCountries}
              onChange={setAxes}
            />
          </div>

          <button
            type="button"
            class="export-menu__action"
            onClick={() => {
              setOpen(false);
              onVisualise(axes);
            }}
          >
            Visualise
          </button>
        </div>
      )}
    </div>
  );
}
