import { useMemo } from "preact/hooks";
import { useCommunity } from "@/community/CommunityContext";
import { useUrlParams } from "@/hooks/useUrlParams";
import { useSearchFacets } from "@/hooks/useSearchFacets";
import { parseSearchParams } from "@/services/searchParams";
import { GeographicHeatMap } from "@/components/visualise/GeographicHeatMap";
import { NotFoundPage } from "./NotFoundPage";
import "./VisualisePage.css";
import "./GeographicHeatMapPage.css";

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
  const { counts, loading, error } = useSearchFacets(params);

  return (
    <div class="visualise-page geographic-heat-map-page">
      <h1 class="visualise-page__title">Geographic heat map</h1>
      {error ? (
        <p class="evidence-map-view__status" role="alert">
          Couldn’t load country counts.
        </p>
      ) : (
        <div
          class={`geographic-heat-map-page__map${loading ? " is-updating" : ""}`}
          aria-busy={loading}
        >
          <GeographicHeatMap
            counts={counts?.countries}
            label={`World map of ${countNoun} by country`}
            countNoun={countNoun}
          />
        </div>
      )}
    </div>
  );
}
