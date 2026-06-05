import { useId, useMemo, useState } from "preact/hooks";
import { FilterCardList } from "@/components/filters/FilterCardList";
import {
  useFilterDraft,
  type AppliedFilters,
} from "@/components/filters/useFilterDraft";
import { axisToken, parseAxis } from "@/services/evidenceMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { SearchParams } from "@/services/searchParams";
import type { EvidenceMapAxis, EvidenceMapAxes } from "@/types/models";
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
  onApply: (next: { axes: EvidenceMapAxes; filters: AppliedFilters }) => void;
}

interface AxisOption {
  value: string;
  label: string;
}

// Last path/fragment/CURIE segment — a label fallback for a scheme axis whose
// vocabulary hasn't loaded yet (so its <select> option still reads sensibly).
function localName(uri: string): string {
  return uri.split(/[/#:]/).filter(Boolean).pop() ?? uri;
}

// Scheme options (in vocabulary order) + Countries, plus any drafted axis whose
// scheme isn't in the list yet — so each <select> always has its current value.
function buildAxisOptions(
  schemes: ConceptScheme[],
  drafted: EvidenceMapAxis[],
): AxisOption[] {
  const byValue = new Map<string, string>();
  for (const scheme of schemes) {
    byValue.set(scheme.uri, schemeDisplayLabel(scheme.label));
  }
  byValue.set(AXIS_COUNTRIES, "Countries");
  for (const axis of drafted) {
    const token = axisToken(axis);
    if (!byValue.has(token)) byValue.set(token, localName(token));
  }
  return [...byValue].map(([value, label]) => ({ value, label }));
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
    () => buildAxisOptions(schemes, [rowDraft, columnDraft]),
    [schemes, rowDraft, columnDraft],
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
      <div class="map-config-panel__body">
        <section class="map-config-panel__section">
          <h2 class="map-config-panel__section-title">Axes</h2>
          <AxisSelect
            label="Rows (y)"
            value={axisToken(rowDraft)}
            options={options}
            disabledValue={axisToken(columnDraft)}
            onChange={(token) => setRowDraft(parseAxis(token))}
          />
          <AxisSelect
            label="Columns (x)"
            value={axisToken(columnDraft)}
            options={options}
            disabledValue={axisToken(rowDraft)}
            onChange={(token) => setColumnDraft(parseAxis(token))}
          />
        </section>

        <section class="map-config-panel__section">
          <h2 class="map-config-panel__section-title">Filters</h2>
          <FilterCardList draft={draft} countNoun={countNoun} />
        </section>
      </div>

      <footer class="map-config-panel__footer">
        <button
          type="button"
          class="map-config-panel__btn map-config-panel__btn--reset"
          onClick={handleReset}
        >
          Reset all
        </button>
        <button
          type="button"
          class="map-config-panel__btn map-config-panel__btn--apply"
          onClick={handleApply}
          disabled={!canApply}
        >
          Show results
        </button>
      </footer>
    </aside>
  );
}

interface AxisSelectProps {
  label: string;
  value: string;
  options: AxisOption[];
  // The value chosen on the other axis — disabled here to avoid a same-axis map.
  disabledValue: string;
  onChange: (token: string) => void;
}

function AxisSelect({
  label,
  value,
  options,
  disabledValue,
  onChange,
}: AxisSelectProps) {
  const id = useId();
  return (
    <div class="map-config-panel__axis">
      <label class="map-config-panel__axis-label" for={id}>
        {label}
      </label>
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
