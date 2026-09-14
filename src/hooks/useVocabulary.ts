import { useState, useEffect } from "preact/hooks";
import { getCachedVocabulary } from "@/services/vocabulary";
import type {
  ConceptScheme,
  VocabularyData,
} from "@/services/vocabulary/vocabularyService";

export interface VocabularyResult {
  labels: Map<string, string> | null;
  broader: Map<string, string> | null;
  definitions: Map<string, string> | null;
  inScheme: Map<string, string> | null;
  schemes: ConceptScheme[] | null;
  loading: boolean;
  error: Error | null;
}

export function useVocabulary(
  vocabularyUrl: string | undefined,
): VocabularyResult {
  const [data, setData] = useState<VocabularyData | null>(null);
  // True from the first render whenever there's a URL to fetch, so callers
  // never see "not loading" before the effect has started the request.
  const [loading, setLoading] = useState(Boolean(vocabularyUrl));
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
    definitions: data?.definitions ?? null,
    inScheme: data?.inScheme ?? null,
    schemes: data?.schemes ?? null,
    loading,
    error,
  };
}
