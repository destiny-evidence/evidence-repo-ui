import { useEffect, useId, useMemo, useRef } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import { useVocabulary } from "@/hooks/useVocabulary";
import {
  appliedFilterCount,
  buildSearchUrl,
  parseSearchParams,
  type SearchParams,
} from "@/services/searchParams";
import {
  buildHeatMapUrl,
  heatMapEnabled,
  heatMapQueryString,
} from "@/services/geoHeatMap";
import { AXIS_COUNTRIES } from "@/services/crossFacets";
import { countSearchMatches } from "@/services/searchCount";
import { navigate } from "@/services/navigation";
import type { FacetType } from "@/services/apiClient";
import type { Community, MapAxis, FacetTotals } from "@/types/models";
import type { ConceptScheme } from "@/services/vocabulary/vocabularyService";
import { track } from "@/analytics/matomo";
import { activeFilters, withoutDefaults } from "@/analytics/searchEvents";
import { formatTotal } from "@/utils/searchTotal";
import { EMPTY_APPLIED_FILTERS } from "@/components/filters/useFilterDraft";
import { Tooltip } from "@/components/common/Tooltip";
import { GeographicHeatMap } from "@/components/visualise/GeographicHeatMap";
import { MapFilterPanel, MapConfigRail } from "@/components/visualise/MapConfigPanel";
import { MapCoverageNote } from "@/components/visualise/MapCoverageNote";
import { MapFiltersMenu } from "@/components/visualise/MapFiltersMenu";
import { MapSourceMenu } from "@/components/visualise/MapSourceMenu";
import { NoMatchesBanner } from "@/components/visualise/NoMatchesBanner";
import { useMapPanel } from "@/components/visualise/useMapPanel";
import { NotFoundPage } from "./NotFoundPage";
import "./VisualisePage.css";
import "./GeographicHeatMapPage.css";

const TITLE_ID = "geographic-heat-map-title";
const FACETS: readonly FacetType[] = ["countries"];
const COUNTRY_AXIS: readonly MapAxis[] = [
  { kind: "literal", token: AXIS_COUNTRIES },
];
const SETTING_NOTE = "Counts come from where each investigation took place.";

interface GeographicHeatMapPageProps {
  path?: string;
}

export function GeographicHeatMapPage(_props: GeographicHeatMapPageProps) {
  const community = useCommunity();
  if (!community || !heatMapEnabled(community.features)) return <NotFoundPage />;
  return <GeographicHeatMapView community={community} />;
}

function GeographicHeatMapView({ community }: { community: Community }) {
  const search = useUrlParams();
  const params = useMemo(() => parseSearchParams(search), [search]);
  const vocab = useVocabulary(community.vocabularyUrl);
  const filterableSchemes = useMemo(
    () =>
      (vocab.schemes ?? []).filter(
        (s) => !community.filterExcludedSchemes.includes(s.uri),
      ),
    [vocab.schemes, community.filterExcludedSchemes],
  );
  const { counts, totals, loading, error } = useSearchFacets(params, FACETS, {
    mapAxes: COUNTRY_AXIS,
    totals: true,
  });
  const { panelOpen, togglePanel, editFilters, railRef, hideRef } =
    useMapPanel("GeographicHeatMap");

  // The first load has the map's own spinner; dimming is for new counts over old.
  const refetching = loading && counts !== null;
  const countryCounts = useMemo(
    () => onlySelected(counts?.countries, params.countryCodes),
    [counts, params.countryCodes],
  );
  const countryCount = countryCounts
    ? [...countryCounts.values()].filter((n) => n > 0).length
    : 0;
  const noun = community.copy.countNoun;

  // Rewrite the URL into canonical form so a freshly-loaded map is linkable.
  // Replace, not push, so Back skips it.
  const canonical = heatMapQueryString(params);
  useEffect(() => {
    const current = search.startsWith("?") ? search.slice(1) : search;
    if (current !== canonical) {
      navigate(buildHeatMapUrl(community.slug, params), { mode: "replace" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical, community.slug]);

  const lastViewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !totals || vocab.loading) return;
    if (lastViewTracked.current === canonical) return;
    lastViewTracked.current = canonical;
    trackView(community, params, totals, filterableSchemes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, totals, vocab.loading, canonical]);

  function apply(next: SearchParams) {
    navigate(buildHeatMapUrl(community.slug, { ...next, page: 1 }));
  }

  function handleQueryChange(q: string) {
    track({
      category: "GeographicHeatMap",
      action: "Search Changed",
      name: q ? "updated" : "cleared",
    });
    apply({ ...params, q });
  }

  function handleResetAll() {
    track({ category: "GeographicHeatMap", action: "Reset All", name: "banner" });
    apply({ ...params, ...EMPTY_APPLIED_FILTERS });
  }

  const filterCount = appliedFilterCount(params);

  return (
    <div class="evidence-map-view">
      <div class="evidence-map-view__main">
        <h1 class="visualise-page__title" id={TITLE_ID} tabIndex={-1}>
          Geographic heat map
        </h1>
        <div class="evidence-map-view__toolbar">
          <div class="evidence-map-view__scope">
            <MapSourceMenu
              query={params.q}
              placeholder={community.copy.searchPlaceholder}
              countNoun={noun}
              countMatches={(q) =>
                countSearchMatches({ ...params, q }, community.defaultAnnotations)
              }
              onApply={handleQueryChange}
            />
            <MapFiltersMenu
              params={params}
              count={filterCount}
              schemes={vocab.schemes ?? []}
              onEditInPanel={editFilters}
            />
          </div>
          <p class="evidence-map-view__hint">
            <a
              class="evidence-map-view__view-all"
              href={buildSearchUrl(community.slug, { ...params, page: 1 })}
            >
              View {noun} <span aria-hidden="true">→</span>
            </a>
          </p>
        </div>

        {error ? (
          <p class="evidence-map-view__status" role="alert">
            Couldn’t load the geographic heat map.
          </p>
        ) : (
          <>
            {totals && (
              <CoverageMessage
                totals={totals}
                countNoun={noun}
                onReset={handleResetAll}
              />
            )}
            <section
              class={`geographic-heat-map-page__card${refetching ? " is-updating" : ""}`}
              aria-busy={refetching}
            >
              {totals?.mapped && totals.mapped.count > 0 && (
                <div class="geographic-heat-map-page__summary">
                  <p class="geographic-heat-map-page__total">
                    <span class="geographic-heat-map-page__count">
                      {formatTotal(totals.mapped)}
                    </span>{" "}
                    unique {noun} across {countryCount.toLocaleString()}{" "}
                    {countryCount === 1 ? "country" : "countries"}
                  </p>
                  <LocationNote />
                </div>
              )}
              <GeographicHeatMap
                counts={countryCounts}
                label={`World map of ${noun} by country`}
                countNoun={noun}
              />
            </section>
          </>
        )}
      </div>

      <MapFilterPanel
        key={canonical}
        label="Filter the geographic heat map"
        category="GeographicHeatMap"
        schemes={vocab.error ? null : filterableSchemes}
        loading={vocab.loading}
        showCountryDerivedFilters={community.features.countrySearchable}
        pinnedFilters={community.pinnedFilters}
        collapsibleConceptFilters={community.features.ancestorClosedCodings}
        mapAxes={COUNTRY_AXIS}
        appliedConceptFilters={params.conceptFilters}
        appliedCountryCodes={params.countryCodes}
        appliedWbIncomeGroupIds={params.wbIncomeGroupIds}
        appliedStartYear={params.startYear}
        appliedEndYear={params.endYear}
        params={params}
        countNoun={noun}
        onApply={(filters) => apply({ ...params, ...filters })}
        hidden={!panelOpen}
        onHide={() => togglePanel(false)}
        hideButtonRef={hideRef}
      />
      {!panelOpen && (
        <MapConfigRail
          label="Filters"
          filterCount={filterCount}
          onOpen={() => togglePanel(true)}
          buttonRef={railRef}
        />
      )}
    </div>
  );
}

function CoverageMessage({
  totals,
  countNoun,
  onReset,
}: {
  totals: FacetTotals;
  countNoun: string;
  onReset: () => void;
}) {
  const { search, mapped } = totals;
  if (search.count === 0) {
    return <NoMatchesBanner countNoun={countNoun} onReset={onReset} />;
  }
  if (!mapped) return null;
  if (mapped.count === 0) {
    return (
      <p class="evidence-map-view__note" role="status">
        <span class="evidence-map-view__note-count">{formatTotal(search)}</span>{" "}
        {countNoun} match your filters, but none have a country coded — nothing to
        place on the map.
      </p>
    );
  }
  return (
    <MapCoverageNote
      totals={{ search, mapped }}
      countNoun={countNoun}
      detail="Only those with a country coded can be placed. The rest are in your search results."
      storageKey="geographic-heat-map-coverage-note-dismissed"
      returnFocusTo={TITLE_ID}
    />
  );
}

function LocationNote() {
  const descriptionId = useId();
  return (
    <p class="geographic-heat-map-page__location">
      <span class="geographic-heat-map-page__location-label">Location</span>
      Investigation setting
      <Tooltip text={SETTING_NOTE}>
        <button
          type="button"
          class="geographic-heat-map-page__info"
          aria-label="About investigation setting"
          aria-describedby={descriptionId}
        >
          i
        </button>
      </Tooltip>
      <span id={descriptionId} hidden>
        {SETTING_NOTE}
      </span>
    </p>
  );
}

function trackView(
  community: Community,
  params: SearchParams,
  totals: FacetTotals,
  schemes: ConceptScheme[],
) {
  track({ category: "GeographicHeatMap", action: "Map Viewed" });

  const { values, categories } = activeFilters(
    withoutDefaults(community, params),
    schemes,
  );
  for (const name of values) {
    track({ category: "GeographicHeatMap", action: "Filter Applied", name });
  }
  for (const name of categories) {
    track({ category: "GeographicHeatMap", action: "Filter Category Applied", name });
  }

  if (totals.search.count === 0) {
    track({ category: "GeographicHeatMap", action: "No Coverage", name: "over-filtered" });
  } else if (totals.mapped?.count === 0) {
    track({ category: "GeographicHeatMap", action: "No Coverage", name: "no-coverage" });
  }
}

// The API's country counts ignore the country filter, so exclude countries outside it.
function onlySelected(
  counts: ReadonlyMap<string, number> | undefined,
  selected: readonly string[],
): ReadonlyMap<string, number> | undefined {
  if (!counts || selected.length === 0) return counts;
  return new Map([...counts].filter(([code]) => selected.includes(code)));
}
