import { useId, useMemo, useState } from "preact/hooks";
import { FilterCardList } from "@/components/filters/FilterCardList";
import { FilterActions } from "@/components/filters/FilterActions";
import {
  useFilterDraft,
  type AppliedFilters,
} from "@/components/filters/useFilterDraft";
import { axisToken, localName, parseAxis } from "@/services/evidenceMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { SearchParams } from "@/services/searchParams";
import type {
  EvidenceMapAxis,
  EvidenceMapAxes,
  PinnedFilter,
} from "@/types/models";
import "./MapConfigPanel.css";

interface MapConfigPanelProps {
  // Filterable concept schemes — both the axis options and the filter cards.
  schemes: ConceptScheme[];
  // Currently-applied axes (from the URL) → the initial axis draft.
  appliedAxes: EvidenceMapAxes;
  // Community defaults — what "Reset all" restores the axes to.
  defaultAxes: EvidenceMapAxes;
  appliedConceptFilters: readonly (readonly string[])[];
  appliedCountryCodes: readonly string[];
  appliedStartYear: number | undefined;
  appliedEndYear: number | undefined;
  // Drives the facet-count preview (q / annotations live here).
  params: SearchParams;
  countNoun?: string;
  // Hide the facet-backed Country card where the `countries` facet is empty;
  // the Country concept-scheme card still renders from `schemes`.
  showCountryFacetFilter?: boolean;
  // Filter cards pinned to the top; absent ⇒ DEFAULT_PINNED_FILTERS.
  pinnedFilters?: readonly PinnedFilter[];
  onApply: (next: { axes: EvidenceMapAxes; filters: AppliedFilters }) => void;
}

interface AxisOption {
  value: string;
  label: string;
}

// Concept schemes + Countries, plus any drafted axis whose scheme isn't in the
// list yet (so each <select> always has its current value), sorted by label.
function buildAxisOptions(
  schemes: ConceptScheme[],
  drafted: EvidenceMapAxis[],
  includeCountries: boolean,
): AxisOption[] {
  const byValue = new Map<string, string>();
  for (const scheme of schemes) {
    byValue.set(scheme.uri, schemeDisplayLabel(scheme.label));
  }
  // Only offer Countries where the facet is populated; against an empty
  // country facet the cross-facet query for that axis fails.
  if (includeCountries) byValue.set(AXIS_COUNTRIES, "Countries");
  for (const axis of drafted) {
    const token = axisToken(axis);
    if (!byValue.has(token)) byValue.set(token, localName(token));
  }
  return [...byValue]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function axesEqual(a: EvidenceMapAxes, b: EvidenceMapAxes): boolean {
  return (
    axisToken(a.row) === axisToken(b.row) &&
    axisToken(a.column) === axisToken(b.column)
  );
}

/**
 * The persistent right-hand panel that configures the evidence map: row/column
 * axis dropdowns plus the search-page filters. Everything is draft state —
 * "Show results" commits the axes + filters to the URL, "Reset all" returns the
 * axes to the community defaults and clears the filters.
 */
export function MapConfigPanel({
  schemes,
  appliedAxes,
  defaultAxes,
  appliedConceptFilters,
  appliedCountryCodes,
  appliedStartYear,
  appliedEndYear,
  params,
  countNoun = "results",
  showCountryFacetFilter = true,
  pinnedFilters,
  onApply,
}: MapConfigPanelProps) {
  const [rowDraft, setRowDraft] = useState<EvidenceMapAxis>(appliedAxes.row);
  const [columnDraft, setColumnDraft] = useState<EvidenceMapAxis>(
    appliedAxes.column,
  );

  const draft = useFilterDraft({
    schemes,
    appliedConceptFilters,
    appliedCountryCodes,
    appliedStartYear,
    appliedEndYear,
    params,
  });

  const options = useMemo(
    () => buildAxisOptions(schemes, [rowDraft, columnDraft], showCountryFacetFilter),
    [schemes, rowDraft, columnDraft, showCountryFacetFilter],
  );

  const draftAxes: EvidenceMapAxes = { row: rowDraft, column: columnDraft };
  const axesDirty = !axesEqual(draftAxes, appliedAxes);
  const canApply = (axesDirty || draft.dirty) && draft.yearValidation.ok;

  function handleReset() {
    setRowDraft(defaultAxes.row);
    setColumnDraft(defaultAxes.column);
    draft.reset();
  }

  function handleApply() {
    const filters = draft.buildApplied();
    if (filters) onApply({ axes: draftAxes, filters });
  }

  return (
    <aside class="map-config-panel" aria-label="Configure the evidence map">
      <header class="map-config-panel__header">
        <h2 class="map-config-panel__heading">Configure map</h2>
      </header>

      <div class="map-config-panel__body">
        <div class="map-config-panel__axes">
          <AxisSelect
            label="Columns (x)"
            icon="↔"
            value={axisToken(columnDraft)}
            options={options}
            disabledValue={axisToken(rowDraft)}
            onChange={(token) => setColumnDraft(parseAxis(token))}
          />
          <AxisSelect
            label="Rows (y)"
            icon="↕"
            value={axisToken(rowDraft)}
            options={options}
            disabledValue={axisToken(columnDraft)}
            onChange={(token) => setRowDraft(parseAxis(token))}
          />
        </div>

        <section class="map-config-panel__section">
          <h3 class="map-config-panel__section-title">Filters</h3>
          <FilterCardList
            draft={draft}
            countNoun={countNoun}
            showCountryFacetFilter={showCountryFacetFilter}
            pinnedFilters={pinnedFilters}
          />
        </section>
      </div>

      <FilterActions
        onReset={handleReset}
        onApply={handleApply}
        applyDisabled={!canApply}
      />
    </aside>
  );
}

interface AxisSelectProps {
  label: string;
  // Direction glyph mirroring the grid's axis legend (↕ rows, ↔ columns).
  icon: string;
  value: string;
  options: AxisOption[];
  // The value chosen on the other axis — disabled here to avoid a same-axis map.
  disabledValue: string;
  onChange: (token: string) => void;
}

function AxisSelect({
  label,
  icon,
  value,
  options,
  disabledValue,
  onChange,
}: AxisSelectProps) {
  const id = useId();
  return (
    <div class="map-config-panel__axis">
      {/* Icon sits outside the <label> so it stays out of the field's
          accessible name (it's decorative). */}
      <span class="map-config-panel__axis-label lg-label">
        <span class="map-config-panel__axis-icon" aria-hidden="true">
          {icon}
        </span>
        <label for={id}>{label}</label>
      </span>
      <select
        id={id}
        class="map-config-panel__axis-select"
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.value === disabledValue && option.value !== value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
