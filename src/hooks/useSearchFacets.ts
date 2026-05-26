import { useEffect, useState } from "preact/hooks";
import { searchReferenceFacets } from "@/services/apiClient";
import { buildFacetedQuery } from "@/services/searchParams";
import { useCommunity } from "@/community/CommunityContext";
import type { SearchParams } from "@/services/searchParams";

// Cache key for the facets request. Mirrors useSearch's paramsKey but omits
// `page` and `sort` — facet counts are invariant under both, so paging or
// re-sorting must not retrigger the fetch.
function paramsKey(
  params: SearchParams,
  slug: string,
  annotations: string[],
): string {
  return [
    `q=${params.q}`,
    `start=${params.startYear ?? ""}`,
    `end=${params.endYear ?? ""}`,
    `slug=${slug}`,
    `ann=${JSON.stringify(annotations)}`,
    `facets=${JSON.stringify(params.searchFacets)}`,
  ].join("&");
}

export function useSearchFacets(params: SearchParams): {
  counts: ReadonlyMap<string, number> | null;
  loading: boolean;
  error: Error | null;
} {
  const community = useCommunity();
  const key = paramsKey(
    params,
    community?.slug ?? "",
    community?.defaultAnnotations ?? [],
  );
  const [counts, setCounts] = useState<ReadonlyMap<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!community) return;
    let cancelled = false;

    // Mirror useSearch's dim-while-updating: keep prior counts visible while
    // a new fetch is in flight so the drawer doesn't flicker on every search.
    setError(null);
    setLoading(true);

    const wireQuery = buildFacetedQuery(params.q, params.searchFacets);
    searchReferenceFacets(
      wireQuery || undefined,
      {
        startYear: params.startYear,
        endYear: params.endYear,
        annotation: community.defaultAnnotations,
      },
      ["concepts"],
    )
      .then((r) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const { concept, count } of r.concepts ?? []) {
          map.set(concept, count);
        }
        setCounts(map);
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
