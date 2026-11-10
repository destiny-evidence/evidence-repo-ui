import { useEffect, useState } from "preact/hooks";
import { searchReferenceFacets, type FacetType } from "@/services/apiClient";
import { useCommunity } from "@/community/CommunityContext";
import { toTurtleUrl } from "@/services/vocabulary/vocabularyService";
import { toSearchFilters, type SearchParams } from "@/services/searchParams";
import { axisToken } from "@/services/crossFacets";
import type { EvidenceMapAxis, FacetTotals } from "@/types/models";

export interface FacetCounts {
  concepts: ReadonlyMap<string, number>;
  countries: ReadonlyMap<string, number>;
  wbRegions: ReadonlyMap<string, number>;
  wbIncomeGroups: ReadonlyMap<string, number>;
}

function countMap<T extends { count: number }>(
  buckets: readonly T[] | undefined,
  key: (bucket: T) => string,
): ReadonlyMap<string, number> {
  return new Map((buckets ?? []).map((b) => [key(b), b.count]));
}

// `mapAxes` scopes the counts to references with a value on every axis;
// `totals` also asks for the search total, and the mapped total with `mapAxes`.
export function useSearchFacets(
  params: SearchParams,
  facets: readonly FacetType[],
  { mapAxes, totals: withTotals = false }: {
    mapAxes?: readonly EvidenceMapAxis[];
    totals?: boolean;
  } = {},
): {
  counts: FacetCounts | null;
  totals: FacetTotals | null;
  loading: boolean;
  error: Error | null;
} {
  const community = useCommunity();
  const filters = toSearchFilters(params, community?.defaultAnnotations);
  // Omits `page` and `sort` — facet counts are invariant under both.
  const axisTokens = mapAxes?.map(axisToken);
  const key = JSON.stringify([
    community?.slug,
    params.q,
    filters,
    facets,
    axisTokens,
    withTotals,
  ]);
  const [counts, setCounts] = useState<FacetCounts | null>(null);
  const [totals, setTotals] = useState<FacetTotals | null>(null);
  // Loading until the request for this key settles, including the render the
  // key changes in, so stale counts are never reported as current.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!community) return;
    let cancelled = false;

    // Keep prior counts visible while refetching (dim-while-updating).
    setError(null);
    // Backend wants the Turtle vocab; the env URL is the JSON-LD one.
    const vocabularyUrl = toTurtleUrl(community.vocabularyUrl);

    searchReferenceFacets(
      params.q || undefined,
      filters,
      facets,
      { axes: axisTokens, vocabularyUrl, totals: withTotals },
    )
      .then((r) => {
        if (cancelled) return;
        setTotals(r.totals ?? null);
        setCounts({
          concepts: countMap(r.concepts, (b) => b.concept),
          countries: countMap(r.countries, (b) => b.country),
          wbRegions: countMap(r.country_wb_regions, (b) => b.country_wb_region),
          wbIncomeGroups: countMap(
            r.country_wb_income_groups,
            (b) => b.country_wb_income_group,
          ),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setCounts(null);
        setTotals(null);
      })
      .finally(() => { if (!cancelled) setSettledKey(key); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!community) {
    return { counts: null, totals: null, loading: false, error: null };
  }

  return { counts, totals, loading: settledKey !== key, error };
}
