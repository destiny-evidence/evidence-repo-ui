import { useState, useEffect } from "preact/hooks";
import type { Reference } from "@/types/models";
import { getReference } from "@/services/apiClient";

export function useReference(id: string | undefined): {
  reference: Reference | null;
  loading: boolean;
  error: Error | null;
} {
  const [reference, setReference] = useState<Reference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getReference(id)
      .then(setReference)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { reference, loading, error };
}
