import { useState, useEffect } from "preact/hooks";
import {
  getVocabularyResolver,
  type VocabularyResolver,
} from "@/services/vocabulary";

export function useVocabularyResolver(vocabularyUrl: string | undefined): {
  resolver: VocabularyResolver | null;
  loading: boolean;
  error: Error | null;
} {
  const [resolver, setResolver] = useState<VocabularyResolver | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vocabularyUrl) return;

    setLoading(true);
    setError(null);

    getVocabularyResolver(vocabularyUrl)
      .then(setResolver)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [vocabularyUrl]);

  return { resolver, loading, error };
}
