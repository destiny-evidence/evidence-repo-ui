import { useState, useEffect } from "preact/hooks";
import { searchReferences } from "@/services/apiClient";
import type { Community, SearchResultTotal } from "@/types/models";

export function useCorpusTotal(community: Community): {
  total: SearchResultTotal | null;
  loading: boolean;
  error: Error | null;
} {
  const [total, setTotal] = useState<SearchResultTotal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    setTotal(null);
    setError(null);
    setLoading(true);

    searchReferences(undefined, { annotation: community.defaultAnnotations })
      .then((r) => { if (!cancelled) setTotal(r.total); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // Key on slug AND the annotation signature so changes to either force a
    // refetch. JSON.stringify is unambiguous for arbitrary strings — join(",")
    // would collapse ["a,b"] and ["a","b"] to the same key.
  }, [community.slug, JSON.stringify(community.defaultAnnotations)]);

  return { total, loading, error };
}
