import { useMemo } from "preact/hooks";
import { Select } from "@/components/common/Select";
import { Tooltip } from "@/components/common/Tooltip";
import { axisToken, localName, parseAxis } from "@/services/evidenceMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { EvidenceMapAxis, EvidenceMapAxes } from "@/types/models";
import "./MapAxisFields.css";

interface AxisOption {
  value: string;
  label: string;
}

// Concept schemes + Countries, plus any chosen axis whose scheme isn't in the
// list yet (so each <select> always has its current value), sorted by label.
function buildAxisOptions(
  schemes: ConceptScheme[],
  chosen: EvidenceMapAxis[],
  includeCountries: boolean,
): AxisOption[] {
  const byValue = new Map<string, string>();
  for (const scheme of schemes) {
    byValue.set(scheme.uri, schemeDisplayLabel(scheme.label));
  }
  // Only offer Countries where the facet is populated; against an empty
  // country facet the cross-facet query for that axis fails.
  if (includeCountries) byValue.set(AXIS_COUNTRIES, "Countries");
  for (const axis of chosen) {
    const token = axisToken(axis);
    if (!byValue.has(token)) byValue.set(token, localName(token));
  }
  return [...byValue]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

interface MapAxisFieldsProps {
  axes: EvidenceMapAxes;
  schemes: ConceptScheme[];
  includeCountries: boolean;
  onChange: (axes: EvidenceMapAxes) => void;
}

/**
 * The Columns (x) and Rows (y) selects, with a button to swap them. Picking the
 * other axis's field also swaps the two rather than producing a same-axis map.
 */
export function MapAxisFields({
  axes,
  schemes,
  includeCountries,
  onChange,
}: MapAxisFieldsProps) {
  const options = useMemo(
    () => buildAxisOptions(schemes, [axes.row, axes.column], includeCountries),
    [schemes, axes.row, axes.column, includeCountries],
  );

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
