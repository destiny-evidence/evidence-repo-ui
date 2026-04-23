import { useState, useEffect } from "preact/hooks";
import { getCachedVocabulary } from "@/services/vocabulary";

export function useVocabulary(vocabularyUrl: string | undefined): {
  labels: Map<string, string> | null;
  loading: boolean;
  error: Error | null;
} {
  const [labels, setLabels] = useState<Map<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vocabularyUrl) {
      setLabels(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    setLabels(null);
    setLoading(true);
    setError(null);

    getCachedVocabulary(vocabularyUrl)
      .then((r) => { if (!cancelled) setLabels(r); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [vocabularyUrl]);

  return { labels, loading, error };
}
