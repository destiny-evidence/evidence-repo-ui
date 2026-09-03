import { useEffect, useMemo, useRef, useState } from "preact/hooks";
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
  buildAxisBands,
  buildEvidenceMapModel,
  defaultExpandedKeys,
  parseAxis,
  restrictCellsToLeaves,
  resolveMapAxis,
  type ResolvedAxis,
  cellSearchParams,
  axisSearchParams,
  backToVisualiseState,
  type AxisCategory,
  exceedsEvidenceMapRenderLimits,
} from "@/services/evidenceMap";
import { DEFAULT_EVIDENCE_MAP_RENDER_LIMITS } from "@/services/communities";
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
import { track } from "@/analytics/matomo";
import { activeFilters, conceptPathName } from "@/analytics/searchEvents";
import { indexConceptPaths } from "@/components/filters/conceptSchemeFilterState";
import { formatTotal } from "@/utils/searchTotal";
import { EvidenceMapGrid } from "@/components/visualise/EvidenceMapGrid";
import { ViewToggle, type MapView } from "@/components/visualise/ViewToggle";
import { MapConfigPanel } from "@/components/visualise/MapConfigPanel";
import type { AppliedFilters } from "@/components/filters/useFilterDraft";
import { DEFAULT_EXPANDED_FILTERS } from "@/components/filters/filterOrder";
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

// Identity of an axis pair — what "did the axes change?" is decided on. Tokens,
// not the titles analytics reports, so two schemes sharing a title still read as
// a change.
function axisPairToken(axes: EvidenceMapAxes): string {
  return `${axisToken(axes.row)} x ${axisToken(axes.column)}`;
}

interface AxisExpansion {
  axis: string;
  keys: Set<string>;
}

const PAIR_SEPARATOR = " × ";

// The axis pair as analytics reports it
function axisPairTitle(row: ResolvedAxis, column: ResolvedAxis): string {
  return `${row.title}${PAIR_SEPARATOR}${column.title}`;
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

  // Branch paths for every concept the vocabulary knows — not just the
  // filterable subset, since an axis can be pointed at any scheme by URL.
  const conceptPaths = useMemo(
    () => indexConceptPaths(vocab.schemes ?? []),
    [vocab.schemes],
  );

  const axisPair = useMemo<CrossFacetAxisPair>(
    () => ({
      row: toCrossFacetAxis(axes.row),
      column: toCrossFacetAxis(axes.column),
    }),
    [axes],
  );

  const { result, resultAxes, resultParams, loading, error } = useCrossFacets(
    params,
    axisPair,
  );
  const [view, setView] = useState<MapView>("bubble");

  function handleViewChange(next: MapView) {
    track({ category: "EvidenceMap", action: "View Toggled", name: next });
    setView(next);
  }

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

  const nestedAxes = community.features.nestedEvidenceMapAxes;
  const [rowExpansion, setRowExpansion] = useState<AxisExpansion | null>(null);
  const [columnExpansion, setColumnExpansion] =
    useState<AxisExpansion | null>(null);

  const rowAxisIdentity = axisToken(displayAxes.row);
  const columnAxisIdentity = axisToken(displayAxes.column);
  const previousRowAxisIdentity = useRef(rowAxisIdentity);
  const previousColumnAxisIdentity = useRef(columnAxisIdentity);
  useEffect(() => {
    if (previousRowAxisIdentity.current !== rowAxisIdentity) {
      previousRowAxisIdentity.current = rowAxisIdentity;
      setRowExpansion(null);
    }
    if (previousColumnAxisIdentity.current !== columnAxisIdentity) {
      previousColumnAxisIdentity.current = columnAxisIdentity;
      setColumnExpansion(null);
    }
  }, [rowAxisIdentity, columnAxisIdentity]);
  const rowExpandedKeys = useMemo(
    () =>
      rowExpansion?.axis === rowAxisIdentity
        ? rowExpansion.keys
        : defaultExpandedKeys(rowAxis.tree ?? []),
    [rowExpansion, rowAxisIdentity, rowAxis.tree],
  );
  const columnExpandedKeys = useMemo(
    () =>
      columnExpansion?.axis === columnAxisIdentity
        ? columnExpansion.keys
        : defaultExpandedKeys(columnAxis.tree ?? []),
    [columnExpansion, columnAxisIdentity, columnAxis.tree],
  );
  const rowBands = useMemo(
    () =>
      nestedAxes && rowAxis.tree
        ? buildAxisBands(rowAxis.tree, rowExpandedKeys)
        : undefined,
    [nestedAxes, rowAxis.tree, rowExpandedKeys],
  );
  const columnBands = useMemo(
    () =>
      nestedAxes && columnAxis.tree
        ? buildAxisBands(columnAxis.tree, columnExpandedKeys)
        : undefined,
    [nestedAxes, columnAxis.tree, columnExpandedKeys],
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
    const visibleCells = restrictCellsToLeaves(
      result.cells,
      rowBands ? new Set(rowBands.leaves.map(({ key }) => key)) : null,
      columnBands ? new Set(columnBands.leaves.map(({ key }) => key)) : null,
    );
    return buildEvidenceMapModel(
      visibleCells,
      rowBands ? { ...rowAxis, categories: rowBands.leaves } : rowAxis,
      columnBands
        ? { ...columnAxis, categories: columnBands.leaves }
        : columnAxis,
    );
  }, [result, rowAxis, columnAxis, rowBands, columnBands]);

  function handleRowToggle(key: string) {
    setRowExpansion((current) => ({
      axis: rowAxisIdentity,
      keys: toggledKeys(
        current?.axis === rowAxisIdentity ? current.keys : rowExpandedKeys,
        key,
      ),
    }));
  }

  function handleColumnToggle(key: string) {
    setColumnExpansion((current) => ({
      axis: columnAxisIdentity,
      keys: toggledKeys(
        current?.axis === columnAxisIdentity
          ? current.keys
          : columnExpandedKeys,
        key,
      ),
    }));
  }

  function handleCollapseAll() {
    setRowExpansion({ axis: rowAxisIdentity, keys: new Set() });
    setColumnExpansion({ axis: columnAxisIdentity, keys: new Set() });
  }

  const panelExpandedFilters = useMemo(() => {
    if (!nestedAxes) return community.defaultExpandedFilters;
    const expanded = new Set(
      community.defaultExpandedFilters ?? DEFAULT_EXPANDED_FILTERS,
    );
    for (const scheme of filterableSchemes) expanded.delete(scheme.uri);
    if (axes.row.kind === "scheme") expanded.add(axes.row.schemeUri);
    if (axes.column.kind === "scheme") expanded.add(axes.column.schemeUri);
    return [...expanded];
  }, [nestedAxes, community.defaultExpandedFilters, filterableSchemes, axes]);

  // Rewrite the URL into canonical form (filters + explicit default axes) so a
  // freshly-loaded map is linkable. Replace, not push, so Back skips it.
  const canonical = canonicalSearch(params, axes);
  const hasResultSnapshot = resultAxes !== null || resultParams !== null;
  const resultIsStale =
    result !== null &&
    hasResultSnapshot &&
    canonicalSearch(resultParams ?? params, displayAxes) !== canonical;
  const mapUpdating = loading || resultIsStale;
  useEffect(() => {
    const current = search.startsWith("?") ? search.slice(1) : search;
    if (current !== canonical) {
      navigate(`/${community.slug}/visualise?${canonical}`, { mode: "replace" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical, community.slug]);

  // The query the rendered map came from
  const trackedParams = resultParams ?? params;

  // Config + filters for each distinct map view, once.
  const lastViewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (!result || vocab.loading) return;
    const identity = canonicalSearch(trackedParams, displayAxes);
    if (lastViewTracked.current === identity) return;
    lastViewTracked.current = identity;

    track({
      category: "EvidenceMap",
      action: "Map Viewed",
      name: axisPairTitle(rowAxis, columnAxis),
    });

    const { values, categories } = activeFilters(trackedParams, filterableSchemes);
    for (const value of values) {
      track({ category: "EvidenceMap", action: "Filter Applied", name: value });
    }
    for (const key of categories) {
      track({
        category: "EvidenceMap",
        action: "Filter Category Applied",
        name: key,
      });
    }

    if (result.totals.search.count === 0) {
      track({
        category: "EvidenceMap",
        action: "No Coverage",
        name: "over-filtered",
      });
    } else if (result.cells.length === 0) {
      track({
        category: "EvidenceMap",
        action: "No Coverage",
        name: "no-coverage",
      });
    }
  }, [
    result,
    trackedParams,
    displayAxes,
    rowAxis,
    columnAxis,
    vocab.loading,
    filterableSchemes,
  ]);

  // Commit the panel's drafted axes + filters to the URL; the map re-renders
  // off the new params (page reset, like the search page).
  function handleApply({
    axes: nextAxes,
    filters,
  }: {
    axes: EvidenceMapAxes;
    filters: AppliedFilters;
  }) {
    // Deliberately-chosen axes, as opposed to the ones a view merely landed on —
    // the map's own default pair would otherwise dominate `Map Viewed`.
    if (axisPairToken(nextAxes) !== axisPairToken(axes)) {
      track({
        category: "EvidenceMap",
        action: "Axes Changed",
        name: axisPairTitle(
          resolveMapAxis(nextAxes.row, vocab.schemes, vocab.labels),
          resolveMapAxis(nextAxes.column, vocab.schemes, vocab.labels),
        ),
      });
    }
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
    track({
      category: "EvidenceMap",
      action: "Cell Clicked",
      name: `${categoryName(row)}${PAIR_SEPARATOR}${categoryName(column)}`,
    });
    deepLinkToSearch(cellSearchParams(params, axes, row, column));
  }

  // Same deep-link, but filtered by a single axis category (a row/column header
  // click) rather than both.
  function handleRowClick(row: AxisCategory) {
    track({
      category: "EvidenceMap",
      action: "Row Clicked",
      name: categoryName(row),
    });
    deepLinkToSearch(axisSearchParams(params, axes.row, row));
  }

  function handleColumnClick(column: AxisCategory) {
    track({
      category: "EvidenceMap",
      action: "Column Clicked",
      name: categoryName(column),
    });
    deepLinkToSearch(axisSearchParams(params, axes.column, column));
  }

  // Clicked axis values report the same way filters do — the concept's whole
  // branch. A countries axis has no branch, so it falls back to the label.
  function categoryName(category: AxisCategory): string {
    return conceptPathName(conceptPaths, category.key, category.label);
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
    track({ category: "EvidenceMap", action: "Reset All", name: "banner" });
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
  const renderLimits =
    community.evidenceMapRenderLimits ?? DEFAULT_EVIDENCE_MAP_RENDER_LIMITS;
  const oversized =
    nestedAxes &&
    model !== null &&
    exceedsEvidenceMapRenderLimits(
      model.rows.length,
      model.columns.length,
      renderLimits,
    );
  const collapsedRowCount = rowAxis.tree?.length ?? model?.rows.length ?? 0;
  const collapsedColumnCount =
    columnAxis.tree?.length ?? model?.columns.length ?? 0;
  const collapsedStillOversized =
    model !== null &&
    exceedsEvidenceMapRenderLimits(
      collapsedRowCount,
      collapsedColumnCount,
      renderLimits,
    );
  const canCollapseToFit =
    oversized &&
    !collapsedStillOversized &&
    (model.rows.length !== collapsedRowCount ||
      model.columns.length !== collapsedColumnCount);
  // Gate the "click a cell" hint on there being a clickable (non-empty) cell, so
  // it doesn't mislead in the over-filtered or no-coverage states.
  const showHint =
    result !== null && result.cells.length > 0 && hasGrid && !oversized;

  return (
    <div class="evidence-map-view">
      <div class="evidence-map-view__main">
        <h1 class="visualise-page__title">Evidence map</h1>
        <div class="evidence-map-view__toolbar">
          <ViewToggle value={view} onChange={handleViewChange} />
          {nestedAxes && (
            <button
              type="button"
              class="evidence-map-view__collapse"
              disabled={
                rowExpandedKeys.size === 0 && columnExpandedKeys.size === 0
              }
              onClick={handleCollapseAll}
            >
              Collapse all
            </button>
          )}
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
            {model && hasGrid && oversized ? (
              <p class="evidence-map-view__status" role="status">
                {canCollapseToFit
                  ? "This expansion is too large to display. Use Collapse all to return to the top-level concepts."
                  : "This map is too large to display even with both axes collapsed. Choose different axes."}
              </p>
            ) : model && hasGrid ? (
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
                updating={mapUpdating}
                rowBands={rowBands}
                columnBands={columnBands}
                onToggleRow={rowBands ? handleRowToggle : undefined}
                onToggleColumn={columnBands ? handleColumnToggle : undefined}
                // Disable navigation whenever the displayed result and URL differ,
                // including the render before the loading effect runs.
                onCellClick={mapUpdating ? undefined : handleCellClick}
                // Headers deep-link by a single axis. Disabled while refetching
                // (stale keys) and in the over-filtered state, where adding a
                // filter to a 0-result set is pointless.
                onRowClick={
                  mapUpdating || result.totals.search.count === 0
                    ? undefined
                    : handleRowClick
                }
                onColumnClick={
                  mapUpdating || result.totals.search.count === 0
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
        defaultExpandedFilters={panelExpandedFilters}
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

function toggledKeys(keys: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
