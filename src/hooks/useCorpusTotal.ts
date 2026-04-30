import { useState, useEffect } from "preact/hooks";
import { searchReferences } from "@/services/apiClient";
import { useCommunity } from "@/community/CommunityContext";
import type { SearchResultTotal } from "@/types/models";

export function useCorpusTotal(): {
  total: SearchResultTotal | null;
  loading: boolean;
  error: Error | null;
} {
  const community = useCommunity();
  const [total, setTotal] = useState<SearchResultTotal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!community) return;
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
  }, [community?.slug, JSON.stringify(community?.defaultAnnotations ?? [])]);

  // Synthetic idle when no community is resolved (invalid slug, root path).
  // Page-level NotFound rendering stays in SearchPage; this is a defensive
  // fallback for any subtree under the provider. Internal total state from a
  // prior fetch is masked but not cleared: a long-lived consumer that
  // survives a valid->null->valid community transition would briefly show the
  // prior total during the next fetch. SearchPage sidesteps this because it
  // unmounts on the route-level gate.
  if (!community) return { total: null, loading: false, error: null };

  return { total, loading, error };
}
