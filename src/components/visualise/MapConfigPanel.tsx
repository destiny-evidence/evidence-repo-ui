import type { ComponentChildren, Ref } from "preact";
import { useState } from "preact/hooks";
import { ChevronRightIcon, FilterIcon } from "@/components/common/icons";
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
import { axisToken, toCrossFacetAxis } from "@/services/evidenceMap";
import type { EvidenceMapAxes } from "@/types/models";
import { MapAxisFields } from "./MapAxisFields";
import "./MapConfigPanel.css";

const PANEL_ID = "map-config-panel";

// Folding the panel hides it rather than unmounting it, so an unapplied draft
// survives a Hide and reopen.
interface PanelChromeProps {
  hidden: boolean;
  onHide: () => void;
  hideButtonRef?: Ref<HTMLButtonElement>;
}

interface MapConfigPanelProps extends MapConfigPanelInnerProps, PanelChromeProps {
  loading: boolean;
}

// `schemes` and `showCountryFacetFilter` also drive the axis dropdowns.
interface MapConfigPanelInnerProps extends FilterDraftInputs, FilterCardOptions {
  // Currently-applied axes (from the URL) → the initial axis draft.
  appliedAxes: EvidenceMapAxes;
  // Community defaults — what "Reset all" restores the axes to.
  defaultAxes: EvidenceMapAxes;
  onApply: (next: { axes: EvidenceMapAxes; filters: AppliedFilters }) => void;
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
function MapConfigPanelLoading() {
  return (
    <div class="map-config-panel__body">
      <p class="map-config-panel__status" role="status">
        Loading filters…
      </p>
    </div>
  );
}

function PanelFrame({
  hidden,
  onHide,
  hideButtonRef,
  children,
}: PanelChromeProps & { children: ComponentChildren }) {
  return (
    <aside
      id={PANEL_ID}
      class="map-config-panel"
      aria-label="Configure the evidence map"
      hidden={hidden}
    >
      <div class="map-config-panel__frame">
        <header class="map-config-panel__header">
          <h2 class="map-config-panel__heading">Configure map</h2>
          <button
            type="button"
            class="map-config-panel__hide"
            onClick={onHide}
            ref={hideButtonRef}
          >
            <ChevronRightIcon />
            Hide panel
          </button>
        </header>
        {children}
      </div>
    </aside>
  );
}

/**
 * The slim rail the panel folds into. The whole rail opens the panel, and a
 * count pill keeps applied filters visible while it is folded.
 */
export function MapConfigRail({
  filterCount,
  onOpen,
  buttonRef,
}: {
  filterCount: number;
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div class="map-config-rail">
      <button
        type="button"
        class="map-config-rail__button"
        aria-expanded="false"
        aria-controls={PANEL_ID}
        aria-label={
          filterCount > 0
            ? `Configure map, ${filterCount} ${filterCount === 1 ? "filter" : "filters"} applied`
            : "Configure map"
        }
        onClick={onOpen}
        ref={buttonRef}
      >
        <span class="map-config-rail__icon">
          <FilterIcon />
          {filterCount > 0 && (
            <span class="map-config-rail__count">{filterCount}</span>
          )}
        </span>
        <span class="map-config-rail__label">Configure map</span>
      </button>
    </div>
  );
}

/**
 * The persistent right-hand panel that configures the evidence map: row/column
 * axis dropdowns plus the search-page filters. Everything is draft state —
 * "Show results" commits the axes + filters to the URL, "Reset all" returns the
 * axes to the community defaults and clears the filters.
 *
 * A vocabulary with no filterable schemes still counts as loaded, and one that
 * failed still leaves the axes and the year/country cards usable — applied
 * concept filters then ride along unchanged.
 */
export function MapConfigPanel({
  loading,
  hidden,
  onHide,
  hideButtonRef,
  ...rest
}: MapConfigPanelProps) {
  return (
    <PanelFrame hidden={hidden} onHide={onHide} hideButtonRef={hideButtonRef}>
      {loading ? <MapConfigPanelLoading /> : <MapConfigPanelInner {...rest} />}
    </PanelFrame>
  );
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
  const [draftAxes, setDraftAxes] = useState<EvidenceMapAxes>(appliedAxes);

  const draft = useFilterDraft({
    schemes,
    appliedConceptFilters,
    appliedCountryCodes,
    appliedStartYear,
    appliedEndYear,
    params,
    axes: {
      row: toCrossFacetAxis(draftAxes.row),
      column: toCrossFacetAxis(draftAxes.column),
    },
  });

  const axesDirty = !axesEqual(draftAxes, appliedAxes);
  const canApply = (axesDirty || draft.dirty) && draft.yearValidation.ok;

  function handleReset() {
    // Named apart from the over-filtered banner's one-click reset: this one only
    // clears the draft, so it needn't end in a committed view.
    track({ category: "EvidenceMap", action: "Reset All", name: "panel" });
    setDraftAxes(defaultAxes);
    draft.reset();
  }

  function handleApply() {
    const filters = draft.buildApplied();
    if (filters) onApply({ axes: draftAxes, filters });
  }

  return (
    <>
      <div class="map-config-panel__body">
        <div class="map-config-panel__axes">
          <MapAxisFields
            axes={draftAxes}
            schemes={schemes ?? []}
            includeCountries={showCountryFacetFilter}
            onChange={setDraftAxes}
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
    </>
  );
}
