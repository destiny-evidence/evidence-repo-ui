import { useEffect, useState } from "preact/hooks";
import { searchReferenceFacets } from "@/services/apiClient";
import { useCommunity } from "@/community/CommunityContext";
import { toTurtleUrl } from "@/services/vocabulary/vocabularyService";
import { toSearchFilters, type SearchParams } from "@/services/searchParams";
import { axisPairToParams, type CrossFacetAxisPair } from "@/services/crossFacets";

export interface FacetCounts {
  concepts: ReadonlyMap<string, number>;
  countries: ReadonlyMap<string, number>;
  wbRegions: ReadonlyMap<string, number>;
}

function countMap<T extends { count: number }>(
  buckets: readonly T[] | undefined,
  key: (bucket: T) => string,
): ReadonlyMap<string, number> {
  return new Map((buckets ?? []).map((b) => [key(b), b.count]));
}

export function useSearchFacets(params: SearchParams, axes?: CrossFacetAxisPair): {
  counts: FacetCounts | null;
  loading: boolean;
  error: Error | null;
} {
  const community = useCommunity();
  const filters = toSearchFilters(params, community?.defaultAnnotations);
  // Omits `page` and `sort` — facet counts are invariant under both.
  const key = JSON.stringify([community?.slug, params.q, filters, axes?.row, axes?.column]);
  const [counts, setCounts] = useState<FacetCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!community) return;
    let cancelled = false;

    // Keep prior counts visible while refetching (dim-while-updating).
    setError(null);
    setLoading(true);
    // Backend wants the Turtle vocab; the env URL is the JSON-LD one.
    const vocabularyUrl = toTurtleUrl(community.vocabularyUrl);

    searchReferenceFacets(
      params.q || undefined,
      filters,
      ["concepts", "countries", "country_wb_regions"],
      axes ? axisPairToParams(axes, vocabularyUrl) : { vocabularyUrl },
    )
      .then((r) => {
        if (cancelled) return;
        setCounts({
          concepts: countMap(r.concepts, (b) => b.concept),
          countries: countMap(r.countries, (b) => b.country),
          wbRegions: countMap(r.country_wb_regions, (b) => b.country_wb_region),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setCounts(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!community) return { counts: null, loading: false, error: null };

  return { counts, loading, error };
}
