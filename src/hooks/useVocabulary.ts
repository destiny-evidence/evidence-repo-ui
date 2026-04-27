import { useState, useEffect } from "preact/hooks";
import { getCachedVocabulary } from "@/services/vocabulary";
import type { VocabularyData } from "@/services/vocabulary/vocabularyService";

export function useVocabulary(vocabularyUrl: string | undefined): {
  labels: Map<string, string> | null;
  broader: Map<string, string> | null;
  loading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<VocabularyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vocabularyUrl) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    setData(null);
    setLoading(true);
    setError(null);

    getCachedVocabulary(vocabularyUrl)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [vocabularyUrl]);

  return {
    labels: data?.labels ?? null,
    broader: data?.broader ?? null,
    loading,
    error,
  };
}
