import { useState, useEffect, useCallback } from "preact/hooks";
import { searchReferences } from "@/services/apiClient";
import type { SearchResult } from "@/types/models";
import type { SearchParams } from "@/services/searchParams";

function paramsKey(params: SearchParams, annotations: string[]): string {
  // JSON.stringify is unambiguous for arbitrary string arrays — two distinct
  // inputs can never collapse to the same key even if annotations contain commas,
  // quotes, or other delimiters. Ad hoc joins are brittle here.
  // Intentionally order-sensitive: ["a","b"] and ["b","a"] are different keys.
  // Worst case is an unnecessary refetch when caller varies order; the alternative
  // (sort-then-stringify) would silently mask callers passing inconsistent orders.
  return [
    `q=${params.q}`,
    `page=${params.page}`,
    `start=${params.startYear ?? ""}`,
    `end=${params.endYear ?? ""}`,
    `ann=${JSON.stringify(annotations)}`,
  ].join("&");
}

export function useSearch(
  params: SearchParams,
  annotations: string[],
): {
  results: SearchResult | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
} {
  const key = paramsKey(params, annotations);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const retry = useCallback(() => {
    setRetryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Do NOT clear results here: keeping prior rows on screen enables the
    // "dim-while-updating" UX from the spec. On settled error we clear below.
    setError(null);
    setLoading(true);

    searchReferences(params.q || undefined, {
      page: params.page,
      startYear: params.startYear,
      endYear: params.endYear,
      annotation: annotations,
    })
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

  return { results, loading, error, retry };
}
