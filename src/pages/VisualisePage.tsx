import { useEffect, useMemo, useState } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useCrossFacets } from "@/hooks/useCrossFacets";
import { useVocabulary } from "@/hooks/useVocabulary";
import {
  parseSearchParams,
  toQueryString,
  buildSearchUrl,
  type SearchParams,
} from "@/services/searchParams";
import { navigate } from "@/services/navigation";
import {
  axisToken,
  buildEvidenceMapModel,
  parseAxis,
  resolveMapAxis,
  cellSearchParams,
  axisSearchParams,
  backToVisualiseState,
  type AxisCategory,
} from "@/services/evidenceMap";
import {
  AXIS_COUNTRIES,
  type CrossFacetAxis,
  type CrossFacetAxisPair,
} from "@/services/crossFacets";
import type {
  Community,
  EvidenceMapAxes,
  EvidenceMapAxis,
} from "@/types/models";
import { formatTotal } from "@/utils/searchTotal";
import { EvidenceMapGrid } from "@/components/visualise/EvidenceMapGrid";
import { ViewToggle, type MapView } from "@/components/visualise/ViewToggle";
import { MapConfigPanel } from "@/components/visualise/MapConfigPanel";
import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import { WarningIcon } from "@/components/common/icons";
import { NotFoundPage } from "./NotFoundPage";
import "./VisualisePage.css";

interface VisualisePageProps {
  path?: string;
}

const ROW_PARAM = "row";
const COLUMN_PARAM = "column";

// Config axis → the shape the cross-facets client/hook expects.
function toCrossFacetAxis(axis: EvidenceMapAxis): CrossFacetAxis {
  return axis.kind === "countries"
    ? { kind: "literal", token: AXIS_COUNTRIES }
    : { kind: "scheme", schemeUri: axis.schemeUri };
}

// Inverse of toCrossFacetAxis — recover the config axis from the pair the hook
// reports a result was fetched for. (This page only ever produces the COUNTRIES
// literal, so every literal maps back to a countries axis.)
function fromCrossFacetAxis(axis: CrossFacetAxis): EvidenceMapAxis {
  return axis.kind === "literal"
    ? { kind: "countries" }
    : { kind: "scheme", schemeUri: axis.schemeUri };
}

// The map's axes come from the URL when present (so a link reproduces the view),
// otherwise the community defaults.
function resolveAxes(search: string, defaults: EvidenceMapAxes): EvidenceMapAxes {
  const params = new URLSearchParams(search);
  const row = params.get(ROW_PARAM);
  const column = params.get(COLUMN_PARAM);
  if (!row || !column) return defaults;
  return { row: parseAxis(row), column: parseAxis(column) };
}

// Canonical query string: the filter params followed by the explicit axes, so
// the default view is rewritten into a self-contained, shareable URL on load.
function canonicalSearch(params: SearchParams, axes: EvidenceMapAxes): string {
  const qs = new URLSearchParams(toQueryString(params));
  qs.set(ROW_PARAM, axisToken(axes.row));
  qs.set(COLUMN_PARAM, axisToken(axes.column));
  return qs.toString();
}

export function VisualisePage(_props: VisualisePageProps) {
  const community = useCommunity();
  // Gate the route as well as the tab: a community without the flag should 404
  // here rather than see a feature it doesn't have.
  if (!community || !community.features.evidenceMap) return <NotFoundPage />;
  return <VisualisePageInner community={community} />;
}

function VisualisePageInner({ community }: { community: Community }) {
  const defaults = community.defaultEvidenceMapAxes;
  // Configured maps render their own layout (title lives inside the map column
  // so the config panel can rise into the title's row); the notice doesn't.
  if (!defaults) {
    return (
      <div class="visualise-page">
        <h1 class="visualise-page__title">Evidence map</h1>
        <p class="visualise-page__notice">
          The evidence map isn’t configured for this community yet.
        </p>
      </div>
    );
  }
  return <EvidenceMapView community={community} defaults={defaults} />;
}

function EvidenceMapView({
  community,
  defaults,
}: {
  community: Community;
  defaults: EvidenceMapAxes;
}) {
  const search = useUrlParams();
  const params = useMemo(() => parseSearchParams(search), [search]);
  const axes = useMemo(() => resolveAxes(search, defaults), [search, defaults]);

  const vocab = useVocabulary(community.vocabularyUrl);

  // Schemes offered as axis options and filter cards — the same set the search
  // drawer filters on (excluded schemes make poor facets and poor axes alike).
  const filterableSchemes = useMemo(
    () =>
      (vocab.schemes ?? []).filter(
        (s) => !community.filterExcludedSchemes.includes(s.uri),
      ),
    [vocab.schemes, community.filterExcludedSchemes],
  );

  const axisPair = useMemo<CrossFacetAxisPair>(
    () => ({
      row: toCrossFacetAxis(axes.row),
      column: toCrossFacetAxis(axes.column),
    }),
    [axes],
  );

  const { result, resultAxes, loading, error } = useCrossFacets(params, axisPair);
  const [view, setView] = useState<MapView>("bubble");

  // Resolve labels against the axes `result` was fetched for, not the URL's:
  // during an axis change the URL (and `axes`) flips immediately but `result`
  // still holds the previous axes' cells, so pairing those cells with the new
  // axes' label functions would briefly render raw URIs. Falls back to the URL
  // axes before the first result lands.
  const displayAxes = useMemo<EvidenceMapAxes>(
    () =>
      resultAxes
        ? {
            row: fromCrossFacetAxis(resultAxes.row),
            column: fromCrossFacetAxis(resultAxes.column),
          }
        : axes,
    [resultAxes, axes],
  );

  // Header title + per-value label fn per axis — derived from the vocabulary the
  // same way the filter panel names schemes (and via Intl for a country axis).
  const rowAxis = useMemo(
    () => resolveMapAxis(displayAxes.row, vocab.schemes, vocab.labels),
    [displayAxes.row, vocab.schemes, vocab.labels],
  );
  const columnAxis = useMemo(
    () => resolveMapAxis(displayAxes.column, vocab.schemes, vocab.labels),
    [displayAxes.column, vocab.schemes, vocab.labels],
  );

  // Flag the docked configure panel on <body> so the global Feedback button can
  // inset itself out from under it (CSS handles the responsive un-inset). The
  // region itself is pinned to the viewport (see VisualisePage.css), so the
  // page doesn't scroll and the sticky header can't rubber-band over the panel.
  useEffect(() => {
    document.body.classList.add("visualise-has-panel");
    return () => document.body.classList.remove("visualise-has-panel");
  }, []);

  const model = useMemo(() => {
    if (!result) return null;
    return buildEvidenceMapModel(result.cells, rowAxis, columnAxis);
  }, [result, rowAxis, columnAxis]);

  // Rewrite the URL into canonical form (filters + explicit default axes) so a
  // freshly-loaded map is linkable. Replace, not push, so Back skips it.
  const canonical = canonicalSearch(params, axes);
  useEffect(() => {
    const current = search.startsWith("?") ? search.slice(1) : search;
    if (current !== canonical) {
      navigate(`/${community.slug}/visualise?${canonical}`, { mode: "replace" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical, community.slug]);

  // Commit the panel's drafted axes + filters to the URL; the map re-renders
  // off the new params (page reset, like the search page).
  function handleApply({
    axes: nextAxes,
    filters,
  }: {
    axes: EvidenceMapAxes;
    filters: AppliedFilters;
  }) {
    const nextParams: SearchParams = {
      ...params,
      conceptFilters: filters.conceptFilters,
      countryCodes: filters.countryCodes,
      startYear: filters.startYear,
      endYear: filters.endYear,
      page: 1,
    };
    navigate(
      `/${community.slug}/visualise?${canonicalSearch(nextParams, nextAxes)}`,
    );
  }

  // Deep-link a cell into Search: the map's filters plus the cell's row and
  // column applied as filters. Stash the map's own URL in history.state so the
  // search page can offer a "Back to Visualise" link to exactly this view.
  function handleCellClick(row: AxisCategory, column: AxisCategory) {
    deepLinkToSearch(cellSearchParams(params, axes, row, column));
  }

  // Same deep-link, but filtered by a single axis category (a row/column header
  // click) rather than both.
  function handleRowClick(row: AxisCategory) {
    deepLinkToSearch(axisSearchParams(params, axes.row, row));
  }

  function handleColumnClick(column: AxisCategory) {
    deepLinkToSearch(axisSearchParams(params, axes.column, column));
  }

  // Navigate into Search with the given params, stashing the map's own URL in
  // history.state so the search page can offer a "Back to Visualise" link.
  function deepLinkToSearch(next: SearchParams) {
    const mapUrl = `/${community.slug}/visualise?${canonical}`;
    navigate(buildSearchUrl(community.slug, next), {
      state: backToVisualiseState(mapUrl),
    });
  }

  // The over-filtered banner's inline shortcut — the panel's "Reset all" applied
  // in one click: default axes, no filters.
  function handleResetAll() {
    handleApply({
      axes: defaults,
      filters: {
        conceptFilters: [],
        countryCodes: [],
        startYear: undefined,
        endYear: undefined,
      },
    });
  }

  const noun = community.copy.countNoun;
  // Scheme axes draw their categories from the vocabulary, so a greyed grid can
  // render even when no cells come back (the no-coverage state).
  const hasGrid =
    model !== null && model.rows.length > 0 && model.columns.length > 0;
  // Gate the "click a cell" hint on there being a clickable (non-empty) cell, so
  // it doesn't mislead in the over-filtered or no-coverage states.
  const showHint = result !== null && result.cells.length > 0 && hasGrid;

  return (
    <div class="evidence-map-view">
      <div class="evidence-map-view__main">
        <h1 class="visualise-page__title">Evidence map</h1>
        <div class="evidence-map-view__toolbar">
          <ViewToggle value={view} onChange={setView} />
          {showHint && (
            <p class="evidence-map-view__hint">
              Click a cell to view matching {noun}
            </p>
          )}
        </div>

        {error ? (
          <p class="evidence-map-view__status" role="alert">
            Couldn’t load the evidence map.
          </p>
        ) : !result && loading ? (
          <p class="evidence-map-view__status">Loading…</p>
        ) : !result ? null : (
          <>
            {result.totals.search.count === 0 ? (
              // Over-filtered: nothing matches the filters. The greyed grid still
              // renders below (when the axes' categories are known) so the chosen
              // axes stay visible, with a "Reset all" shortcut (wireframe #93).
              <div class="evidence-map-view__banner" role="status">
                <WarningIcon />
                <span class="evidence-map-view__banner-text">
                  No {noun} match the current filters. Please update the filters
                  and try again.
                </span>
                <button
                  type="button"
                  class="evidence-map-view__banner-reset"
                  onClick={handleResetAll}
                >
                  Reset all
                </button>
              </div>
            ) : result.cells.length === 0 ? (
              // Distinct from over-filtered: references match, but none carry a
              // value on both axes — nothing cross-tabulates. The message sits
              // over the greyed-out grid.
              <p class="evidence-map-view__note" role="status">
                <span class="evidence-map-view__note-count">
                  {formatTotal(result.totals.search)}
                </span>{" "}
                {noun} match your filters, but none have a value for both{" "}
                {rowAxis.title} and {columnAxis.title} — nothing to plot on these
                axes.
              </p>
            ) : null}
            {model && hasGrid ? (
              <EvidenceMapGrid
                rows={model.rows}
                columns={model.columns}
                getCount={model.getCount}
                maxCount={model.maxCount}
                view={view}
                countNoun={noun}
                rowAxisLabel={rowAxis.title}
                columnAxisLabel={columnAxis.title}
                total={formatTotal(result.totals.mapped)}
                updating={loading}
                // While refetching, the grid still shows the prior result but
                // params/axes are already the new ones — a stale-cell click would
                // mix old keys with new axes. Disable clicks until the fetch lands.
                onCellClick={loading ? undefined : handleCellClick}
                // Headers deep-link by a single axis. Disabled while refetching
                // (stale keys) and in the over-filtered state, where adding a
                // filter to a 0-result set is pointless.
                onRowClick={
                  loading || result.totals.search.count === 0
                    ? undefined
                    : handleRowClick
                }
                onColumnClick={
                  loading || result.totals.search.count === 0
                    ? undefined
                    : handleColumnClick
                }
                dimmed={result.totals.search.count === 0}
              />
            ) : result.cells.length > 0 ? (
              // Data exists but the vocabulary hasn't supplied categories yet.
              <p class="evidence-map-view__total">
                <span class="evidence-map-view__total-count">
                  {formatTotal(result.totals.mapped)}
                </span>{" "}
                unique {noun}
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* Persistent across every map state — over-filtered included — so the
          config that produced the view stays editable (wireframe #93). Keyed on
          the committed query so it re-hydrates its draft when the URL changes. */}
      <MapConfigPanel
        key={canonical}
        schemes={filterableSchemes}
        showCountryFacetFilter={community.features.countryFacetFilter}
        pinnedFilters={community.pinnedFilters}
        defaultExpandedFilters={community.defaultExpandedFilters}
        appliedAxes={axes}
        defaultAxes={defaults}
        appliedConceptFilters={params.conceptFilters}
        appliedCountryCodes={params.countryCodes}
        appliedStartYear={params.startYear}
        appliedEndYear={params.endYear}
        params={params}
        countNoun={noun}
        onApply={handleApply}
      />
    </div>
  );
}
