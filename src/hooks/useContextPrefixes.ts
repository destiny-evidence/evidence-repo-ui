import { useState, useEffect } from "preact/hooks";
import type { ContextPrefixes } from "@/services/vocabulary/contextService";
import { getCachedContext } from "@/services/vocabulary/contextService";

export function useContextPrefixes(contextUrl: string | undefined): {
  context: ContextPrefixes | null;
  loading: boolean;
  error: Error | null;
} {
  const [context, setContext] = useState<ContextPrefixes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!contextUrl) {
      setContext(null);
      return;
    }
    let cancelled = false;

    setLoading(true);
    setError(null);

    getCachedContext(contextUrl)
      .then((r) => { if (!cancelled) setContext(r); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [contextUrl]);

  return { context, loading, error };
}
