import { useMemo } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import { parseSearchParams } from "@/services/searchParams";
import type { FacetType } from "@/services/apiClient";
import { GeographicHeatMap } from "@/components/visualise/GeographicHeatMap";
import { NotFoundPage } from "./NotFoundPage";
import "./VisualisePage.css";
import "./GeographicHeatMapPage.css";

const FACETS: readonly FacetType[] = ["countries"];

interface GeographicHeatMapPageProps {
  path?: string;
}

export function GeographicHeatMapPage(_props: GeographicHeatMapPageProps) {
  const community = useCommunity();
  if (!community?.features.geographicHeatMap) return <NotFoundPage />;
  return <GeographicHeatMapView countNoun={community.copy.countNoun} />;
}

// Shades the map from the search and filters in the URL.
function GeographicHeatMapView({ countNoun }: { countNoun: string }) {
  const search = useUrlParams();
  const params = useMemo(() => parseSearchParams(search), [search]);
  const { counts, loading, error } = useSearchFacets(params, FACETS);
  // The first load has its own spinner; dimming is for new counts over old.
  const refetching = loading && counts !== null;
  const countryCounts = useMemo(
    () => onlySelected(counts?.countries, params.countryCodes),
    [counts, params.countryCodes],
  );

  return (
    <div class="visualise-page geographic-heat-map-page">
      <h1 class="visualise-page__title">Geographic heat map</h1>
      {error ? (
        <p class="evidence-map-view__status" role="alert">
          Couldn’t load country counts.
        </p>
      ) : (
        <div
          class={`geographic-heat-map-page__map${refetching ? " is-updating" : ""}`}
          aria-busy={refetching}
        >
          <GeographicHeatMap
            counts={countryCounts}
            label={`World map of ${countNoun} by country`}
            countNoun={countNoun}
          />
        </div>
      )}
    </div>
  );
}

// The API's country counts ignore the country filter, so exclude countries outside it.
function onlySelected(
  counts: ReadonlyMap<string, number> | undefined,
  selected: readonly string[],
): ReadonlyMap<string, number> | undefined {
  if (!counts || selected.length === 0) return counts;
  return new Map([...counts].filter(([code]) => selected.includes(code)));
}
