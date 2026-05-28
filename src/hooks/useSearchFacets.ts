import { useEffect, useState } from "preact/hooks";
import { searchReferenceFacets } from "@/services/apiClient";
import { buildLuceneQuery } from "@/services/searchParams";
import { useCommunity } from "@/community/CommunityContext";
import type { SearchParams } from "@/services/searchParams";

// Omits `page` and `sort` — facet counts are invariant under both.
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
    `countries=${JSON.stringify(params.countryCodes)}`,
    `concepts=${JSON.stringify(params.conceptFilters)}`,
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

    // Keep prior counts visible while refetching (dim-while-updating).
    setError(null);
    setLoading(true);

    // Country codes get folded into the Lucene q at the API boundary (backend
    // has no structured country filter); concept filters travel separately as
    // structured params on `filters`.
    const wireQuery = buildLuceneQuery(params.q, params.countryCodes);
    searchReferenceFacets(
      wireQuery || undefined,
      {
        startYear: params.startYear,
        endYear: params.endYear,
        annotation: community.defaultAnnotations,
        conceptFilters: params.conceptFilters,
      },
      ["concepts"],
      { vocabularyUrl: community.vocabularyUrl },
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
