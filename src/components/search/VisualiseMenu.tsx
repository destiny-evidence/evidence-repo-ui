import { useEffect, useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";
import { ChevronDownIcon } from "@/components/common/icons";
import { Tooltip } from "@/components/common/Tooltip";
import { MapAxisFields } from "@/components/visualise/MapAxisFields";
import {
  VISUALISE_VIEWS,
  type VisualiseKind,
} from "@/components/visualise/visualiseViews";
import { formatTotal } from "@/utils/searchTotal";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import type {
  EvidenceMapAxes,
  LiteralAxisToken,
  SearchResultTotal,
} from "@/types/models";
import "./ExportMenu.css";
import "./VisualiseMenu.css";

export type VisualiseOption =
  | {
      kind: "evidence-map";
      // The axes start on these.
      defaultAxes: EvidenceMapAxes;
      schemes: ConceptScheme[];
      literalAxes: readonly LiteralAxisToken[];
    }
  | { kind: "heat-map" };

export type VisualiseChoice =
  | { kind: "evidence-map"; axes: EvidenceMapAxes }
  | { kind: "heat-map" };

interface VisualiseMenuProps {
  total: SearchResultTotal;
  // A new search is loading, so `total` still belongs to the previous one.
  loading: boolean;
  // Whether a query or filters narrow the results, or it's the whole repository.
  scoped: boolean;
  countNoun: string;
  // At least one; a choice between them when there are more.
  options: readonly VisualiseOption[];
  onVisualise: (choice: VisualiseChoice) => void;
}

/**
 * Maps every result of the current search as one of the given views. Shares
 * the Export menu's look.
 */
export function VisualiseMenu({
  total,
  loading,
  scoped,
  countNoun,
  options,
  onVisualise,
}: VisualiseMenuProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<VisualiseKind>();
  // Unset until the user changes them, so they track the defaults.
  const [axes, setAxes] = useState<EvidenceMapAxes>();
  // The choice falls back to the first view if its view is no longer offered.
  const current = options.find((o) => o.kind === kind) ?? options[0];
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
          {options.length > 1 && (
            <>
              <p class="export-menu__label" id={viewLabelId}>
                View as
              </p>
              <div
                class="visualise-menu__views"
                role="radiogroup"
                aria-labelledby={viewLabelId}
              >
                {options.map(({ kind: k }) => {
                  const view = VISUALISE_VIEWS[k];
                  return (
                    <label key={k} class="visualise-menu__view">
                      <input
                        class="visually-hidden"
                        type="radio"
                        name={viewRadioName}
                        value={k}
                        checked={current.kind === k}
                        onChange={() => setKind(k)}
                      />
                      <view.Thumbnail />
                      <span class="visualise-menu__view-name">{view.name}</span>
                    </label>
                  );
                })}
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

          {current.kind === "evidence-map" && (
            <>
              <p class="export-menu__label">Configure map</p>
              <div class="visualise-menu__axes">
                <MapAxisFields
                  axes={axes ?? current.defaultAxes}
                  schemes={current.schemes}
                  literalAxes={current.literalAxes}
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
                current.kind === "evidence-map"
                  ? { kind: current.kind, axes: axes ?? current.defaultAxes }
                  : current,
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
