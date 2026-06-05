import { useEffect, useMemo, useState } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useCrossFacets } from "@/hooks/useCrossFacets";
import { useVocabulary } from "@/hooks/useVocabulary";
import {
  parseSearchParams,
  toQueryString,
  type SearchParams,
} from "@/services/searchParams";
import { navigate } from "@/services/navigation";
import {
  axisToken,
  buildEvidenceMapModel,
  parseAxis,
  resolveMapAxis,
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
  SearchResultTotal,
} from "@/types/models";
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

// Mirrors SearchPage: render "10,000+" when ES caps the count (is_lower_bound).
function formatTotal(total: SearchResultTotal): string {
  return `${total.count.toLocaleString()}${total.is_lower_bound ? "+" : ""}`;
}

// Config axis → the shape the cross-facets client/hook expects.
function toCrossFacetAxis(axis: EvidenceMapAxis): CrossFacetAxis {
  return axis.kind === "countries"
    ? { kind: "literal", token: AXIS_COUNTRIES }
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
  return (
    <div class="visualise-page">
      <h1 class="visualise-page__title">Evidence map</h1>
      {defaults ? (
        <EvidenceMapView community={community} defaults={defaults} />
      ) : (
        <p class="visualise-page__notice">
          The evidence map isn’t configured for this community yet.
        </p>
      )}
    </div>
  );
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

  // Header title + per-value label fn per axis — derived from the vocabulary the
  // same way the filter panel names schemes (and via Intl for a country axis).
  const rowAxis = useMemo(
    () => resolveMapAxis(axes.row, vocab.schemes, vocab.labels),
    [axes.row, vocab.schemes, vocab.labels],
  );
  const columnAxis = useMemo(
    () => resolveMapAxis(axes.column, vocab.schemes, vocab.labels),
    [axes.column, vocab.schemes, vocab.labels],
  );

  const axisPair = useMemo<CrossFacetAxisPair>(
    () => ({
      row: toCrossFacetAxis(axes.row),
      column: toCrossFacetAxis(axes.column),
    }),
    [axes],
  );

  const { result, loading, error } = useCrossFacets(params, axisPair);
  const [view, setView] = useState<MapView>("bubble");

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

  const noun = community.copy.countNoun;
  // Scheme axes draw their categories from the vocabulary, so a greyed grid can
  // render even when no cells come back (the no-coverage state).
  const hasGrid =
    model !== null && model.rows.length > 0 && model.columns.length > 0;

  return (
    <div class="evidence-map-view">
      <div class="evidence-map-view__main">
        <div class="evidence-map-view__toolbar">
          <ViewToggle value={view} onChange={setView} />
        </div>

        {error ? (
          <p class="evidence-map-view__status" role="alert">
            Couldn’t load the evidence map.
          </p>
        ) : !result && loading ? (
          <p class="evidence-map-view__status">Loading…</p>
        ) : !result ? null : result.total.count === 0 ? (
          // Over-filtered: nothing matches the filters — just the banner.
          <div class="evidence-map-view__banner" role="status">
            <WarningIcon />
            <span class="evidence-map-view__banner-text">
              No {noun} match the current filters. Please update the filters and
              try again.
            </span>
          </div>
        ) : (
          <>
            {result.cells.length === 0 && (
              // Distinct from over-filtered: references match, but none carry a
              // value on both axes — nothing cross-tabulates. The message sits
              // over the greyed-out grid.
              <p class="evidence-map-view__note" role="status">
                <span class="evidence-map-view__note-count">
                  {formatTotal(result.total)}
                </span>{" "}
                {noun} match your filters, but none have a value for both{" "}
                {rowAxis.title} and {columnAxis.title} — nothing to plot on these
                axes.
              </p>
            )}
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
                total={formatTotal(result.total)}
              />
            ) : result.cells.length > 0 ? (
              // Data exists but the vocabulary hasn't supplied categories yet.
              <p class="evidence-map-view__total">
                <span class="evidence-map-view__total-count">
                  {formatTotal(result.total)}
                </span>{" "}
                {noun}
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
