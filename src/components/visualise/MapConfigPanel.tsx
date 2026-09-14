import { useMemo, useState } from "preact/hooks";
import { Select } from "@/components/common/Select";
import {
  FilterCardList,
  type FilterCardOptions,
} from "@/components/filters/FilterCardList";
import { FilterActions } from "@/components/filters/FilterActions";
import {
  useFilterDraft,
  type AppliedFilters,
  type FilterDraftInputs,
} from "@/components/filters/useFilterDraft";
import { track } from "@/analytics/matomo";
import { axisToken, localName, parseAxis } from "@/services/evidenceMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import {
  schemeDisplayLabel,
  type ConceptScheme,
} from "@/services/vocabulary/vocabularyService";
import type { EvidenceMapAxis, EvidenceMapAxes } from "@/types/models";
import "./MapConfigPanel.css";

interface MapConfigPanelProps extends Omit<MapConfigPanelInnerProps, "schemes"> {
  // Filterable concept schemes, or null while the vocabulary is still loading.
  schemes: ConceptScheme[] | null;
  schemesError: Error | null;
}

// `schemes` and `showCountryFacetFilter` also drive the axis dropdowns.
interface MapConfigPanelInnerProps extends FilterDraftInputs, FilterCardOptions {
  // Currently-applied axes (from the URL) → the initial axis draft.
  appliedAxes: EvidenceMapAxes;
  // Community defaults — what "Reset all" restores the axes to.
  defaultAxes: EvidenceMapAxes;
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
 * Keeps the panel's heading and width while the vocabulary resolves. It offers
 * no "Show results": the draft can only recognise the URL's concept filters
 * once the schemes naming them are here, so an early commit would wipe them.
 */
function MapConfigPanelFrame({
  status,
  alert,
}: {
  status: string;
  alert?: boolean;
}) {
  return (
    <aside class="map-config-panel" aria-label="Configure the evidence map">
      <header class="map-config-panel__header">
        <h2 class="map-config-panel__heading">Configure map</h2>
      </header>
      <div class="map-config-panel__body">
        <p class="map-config-panel__status" role={alert ? "alert" : "status"}>
          {status}
        </p>
      </div>
    </aside>
  );
}

/**
 * The persistent right-hand panel that configures the evidence map: row/column
 * axis dropdowns plus the search-page filters. Everything is draft state —
 * "Show results" commits the axes + filters to the URL, "Reset all" returns the
 * axes to the community defaults and clears the filters.
 *
 * A vocabulary that loads with no filterable schemes still counts as loaded —
 * the country and year cards stand on their own.
 */
export function MapConfigPanel({
  schemes,
  schemesError,
  ...rest
}: MapConfigPanelProps) {
  if (schemesError) {
    return <MapConfigPanelFrame status="Filters unavailable." alert />;
  }
  if (!schemes) return <MapConfigPanelFrame status="Loading filters…" />;
  return <MapConfigPanelInner schemes={schemes} {...rest} />;
}

function MapConfigPanelInner({
  schemes,
  appliedAxes,
  defaultAxes,
  appliedConceptFilters,
  appliedCountryCodes,
  appliedStartYear,
  appliedEndYear,
  params,
  showCountryFacetFilter = true,
  onApply,
  ...cardOptions
}: MapConfigPanelInnerProps) {
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
    // Named apart from the over-filtered banner's one-click reset: this one only
    // clears the draft, so it needn't end in a committed view.
    track({ category: "EvidenceMap", action: "Reset All", name: "panel" });
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
            showCountryFacetFilter={showCountryFacetFilter}
            {...cardOptions}
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
  return (
    <Select
      label={label}
      labelIcon={icon}
      layout="stacked"
      value={value}
      options={options.map((option) => ({
        ...option,
        disabled: option.value === disabledValue && option.value !== value,
      }))}
      onChange={onChange}
    />
  );
}
