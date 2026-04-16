import { useState, useEffect } from "preact/hooks";
import type { ContextPrefixes } from "@/services/vocabulary/contextService";
import { getCachedContext } from "@/services/vocabulary/contextService";

// Context URLs are immutable (versioned), so this hook does not handle
// cleanup on unmount or stale-data clearing on URL change.
export function useContextPrefixes(contextUrl: string | undefined): {
  context: ContextPrefixes | null;
  loading: boolean;
  error: Error | null;
} {
  const [context, setContext] = useState<ContextPrefixes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!contextUrl) return;
    setLoading(true);
    setError(null);
    getCachedContext(contextUrl)
      .then(setContext)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [contextUrl]);

  return { context, loading, error };
}
