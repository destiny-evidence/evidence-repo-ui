import { useState, useEffect, useCallback } from "preact/hooks";
import { searchReferences, SORT_BACKEND, type SearchFilters } from "@/services/apiClient";
import { useCommunity } from "@/community/CommunityContext";
import type { SearchResult } from "@/types/models";
import type { SearchParams } from "@/services/searchParams";

function paramsKey(params: SearchParams, slug: string, annotations: string[]): string {
  // JSON.stringify is unambiguous for arbitrary string arrays — two distinct
  // inputs can never collapse to the same key even if annotations contain commas,
  // quotes, or other delimiters. Ad hoc joins are brittle here.
  // Intentionally order-sensitive: ["a","b"] and ["b","a"] are different keys.
  return [
    `q=${params.q}`,
    `page=${params.page}`,
    `start=${params.startYear ?? ""}`,
    `end=${params.endYear ?? ""}`,
    `sort=${params.sort ?? ""}`,
    `slug=${slug}`,
    `ann=${JSON.stringify(annotations)}`,
  ].join("&");
}

export function useSearch(params: SearchParams): {
  results: SearchResult | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const community = useCommunity();
  const key = paramsKey(params, community?.slug ?? "", community?.defaultAnnotations ?? []);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const retry = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!community) return;
    let cancelled = false;

    // Do NOT clear results here: keeping prior rows on screen enables the
    // "dim-while-updating" UX from the spec. On settled error we clear below.
    setError(null);
    setLoading(true);

    const filters: SearchFilters = {
      page: params.page,
      startYear: params.startYear,
      endYear: params.endYear,
      annotation: community.defaultAnnotations,
    };
    if (params.sort !== undefined) filters.sort = [SORT_BACKEND[params.sort]];

    searchReferences(params.q || undefined, filters)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setResults(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retryTick]);

  // Synthetic idle when no community is resolved. Page-level NotFound rendering
  // stays in SearchPage; this is a defensive fallback for any subtree under the
  // provider. Internal results state from a prior fetch is masked but not
  // cleared: a long-lived consumer that survives a valid->null->valid community
  // transition would briefly show prior results during the next fetch (the
  // existing dim-while-updating UX). SearchPage sidesteps this because it
  // unmounts on the route-level gate. retry's identity is stable (useCallback
  // with empty deps), so returning it in idle is safe.
  if (!community) return { results: null, loading: false, error: null, retry };

  return { results, loading, error, retry };
}
