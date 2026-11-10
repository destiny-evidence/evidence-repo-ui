import { useEffect, useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { ChevronDownIcon } from "@/components/common/icons";
import { Tooltip } from "@/components/common/Tooltip";
import { MapAxisFields } from "@/components/visualise/MapAxisFields";
import {
  VisualiseThumbnail,
  type VisualiseKind,
} from "@/components/layout/VisualiseThumbnail";
import { formatTotal } from "@/utils/searchTotal";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import type {
  EvidenceMapAxes,
  LiteralAxisToken,
  SearchResultTotal,
} from "@/types/models";
import "./ExportMenu.css";
import "./VisualiseMenu.css";

export type VisualiseChoice =
  | { kind: "evidence-map"; axes: EvidenceMapAxes }
  | { kind: "heat-map" };

const VIEW_NAMES: Record<VisualiseKind, string> = {
  "evidence-map": "Evidence map",
  "heat-map": "Geographic heat map",
};

interface VisualiseMenuProps {
  total: SearchResultTotal;
  // A new search is loading, so `total` still belongs to the previous one.
  loading: boolean;
  // Whether a query or filters narrow the results, or it's the whole repository.
  scoped: boolean;
  countNoun: string;
  // Absent when the community has no evidence map.
  defaultAxes?: EvidenceMapAxes;
  heatMap: boolean;
  schemes: ConceptScheme[];
  literalAxes: readonly LiteralAxisToken[];
  onVisualise: (choice: VisualiseChoice) => void;
}

/**
 * Maps every result of the current search as an evidence map or heat map,
 * offering the choice when the community has both. Shares the Export menu's
 * look; the axes start on the community defaults.
 */
export function VisualiseMenu({
  total,
  loading,
  scoped,
  countNoun,
  defaultAxes,
  heatMap,
  schemes,
  literalAxes,
  onVisualise,
}: VisualiseMenuProps) {
  const [open, setOpen] = useState(false);
  const kinds: VisualiseKind[] = [];
  if (defaultAxes) kinds.push("evidence-map");
  if (heatMap) kinds.push("heat-map");
  const [kind, setKind] = useState<VisualiseKind>(kinds[0]);
  const [axes, setAxes] = useState(defaultAxes);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const viewLabelId = useId();
  const viewRadioName = useId();
  const disabled = loading || total.count === 0;

  useDismiss(open, setOpen, containerRef, buttonRef);

  // Collapse the panel if the control becomes unavailable while open.
  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

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
          aria-label="Visualise these results"
        >
          {kinds.length > 1 && (
            <>
              <p class="export-menu__label" id={viewLabelId}>
                View as
              </p>
              <div
                class="visualise-menu__views"
                role="radiogroup"
                aria-labelledby={viewLabelId}
              >
                {kinds.map((k) => (
                  <label key={k} class="visualise-menu__view">
                    <input
                      class="visually-hidden"
                      type="radio"
                      name={viewRadioName}
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                    />
                    <VisualiseThumbnail kind={k} />
                    <span class="visualise-menu__view-name">{VIEW_NAMES[k]}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <p class="export-menu__label">{countNoun} to map</p>
          <div class="export-menu__option is-disabled visualise-menu__scope">
            <span class="export-menu__option-name">
              {scoped
                ? "All results for this search"
                : `All ${countNoun} in the repository`}
            </span>
            <span class="export-menu__ext">{formatTotal(total)}</span>
          </div>

          {kind === "evidence-map" && axes && (
            <>
              <p class="export-menu__label">Configure map</p>
              <div class="visualise-menu__axes">
                <MapAxisFields
                  axes={axes}
                  schemes={schemes}
                  literalAxes={literalAxes}
                  onChange={setAxes}
                />
              </div>
            </>
          )}

          <button
            type="button"
            class="export-menu__action"
            onClick={() => {
              setOpen(false);
              onVisualise(
                kind === "evidence-map" && axes
                  ? { kind, axes }
                  : { kind: "heat-map" },
              );
            }}
          >
            Visualise
          </button>
        </div>
      )}
    </div>
  );
}
