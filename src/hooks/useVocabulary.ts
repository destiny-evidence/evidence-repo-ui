import { useState, useEffect } from "preact/hooks";
import { getCachedVocabulary } from "@/services/vocabulary";

// Vocabulary URLs are immutable (versioned), so this hook does not handle
// cleanup on unmount or stale-data clearing on URL change.
export function useVocabulary(vocabularyUrl: string | undefined): {
  labels: Map<string, string> | null;
  loading: boolean;
  error: Error | null;
} {
  const [labels, setLabels] = useState<Map<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vocabularyUrl) return;

    setLoading(true);
    setError(null);

    getCachedVocabulary(vocabularyUrl)
      .then(setLabels)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [vocabularyUrl]);

  return { labels, loading, error };
}
