import { Select } from "@/components/common/Select";
import { Tooltip } from "@/components/common/Tooltip";
import {
  literalAxisTitle,
  localName,
  parseAxis,
} from "@/services/evidenceMap";
import { axisToken } from "@/services/crossFacets";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type {
  EvidenceMapAxis,
  EvidenceMapAxes,
  LiteralAxisToken,
} from "@/types/models";
import "./MapAxisFields.css";

interface AxisOption {
  value: string;
  label: string;
}

// Concept schemes + the offered literal axes, plus any chosen axis not in the
// list yet (so each <select> always has its current value), sorted by label.
function buildAxisOptions(
  schemes: ConceptScheme[],
  chosen: EvidenceMapAxis[],
  literalAxes: readonly LiteralAxisToken[],
): AxisOption[] {
  const byValue = new Map<string, string>();
  for (const scheme of schemes) {
    byValue.set(scheme.uri, schemeDisplayLabel(scheme.label));
  }
  for (const token of literalAxes) byValue.set(token, literalAxisTitle(token));
  for (const axis of chosen) {
    const token = axisToken(axis);
    if (byValue.has(token)) continue;
    byValue.set(
      token,
      axis.kind === "literal" ? literalAxisTitle(axis.token) : localName(token),
    );
  }
  return [...byValue]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

interface MapAxisFieldsProps {
  axes: EvidenceMapAxes;
  schemes: ConceptScheme[];
  literalAxes: readonly LiteralAxisToken[];
  onChange: (axes: EvidenceMapAxes) => void;
}

/**
 * The Columns (x) and Rows (y) selects, with a button to swap them. Picking the
 * other axis's field also swaps the two rather than producing a same-axis map.
 */
export function MapAxisFields({
  axes,
  schemes,
  literalAxes,
  onChange,
}: MapAxisFieldsProps) {
  const options = buildAxisOptions(schemes, [axes.row, axes.column], literalAxes);

  function swap() {
    onChange({ row: axes.column, column: axes.row });
  }

  function pickRow(token: string) {
    if (token === axisToken(axes.column)) swap();
    else onChange({ ...axes, row: parseAxis(token) });
  }

  function pickColumn(token: string) {
    if (token === axisToken(axes.row)) swap();
    else onChange({ ...axes, column: parseAxis(token) });
  }

  return (
    <div class="map-axis-fields">
      <Select
        label="Columns (x)"
        labelIcon="↔"
        layout="stacked"
        value={axisToken(axes.column)}
        options={options}
        onChange={pickColumn}
      />
      <Select
        label="Rows (y)"
        labelIcon="↕"
        layout="stacked"
        value={axisToken(axes.row)}
        options={options}
        onChange={pickRow}
      />
      <span class="map-axis-fields__arm map-axis-fields__arm--top" />
      <span class="map-axis-fields__arm map-axis-fields__arm--mid" />
      <span class="map-axis-fields__arm map-axis-fields__arm--bottom" />
      <Tooltip text="Swap axes">
        <button
          type="button"
          class="map-axis-fields__swap"
          aria-label="Swap axes"
          onClick={swap}
        >
          <span class="map-axis-fields__swap-icon" aria-hidden="true">
            ⇅
          </span>
        </button>
      </Tooltip>
    </div>
  );
}
