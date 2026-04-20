import { useState, useEffect } from "preact/hooks";
import type { Reference } from "@/types/models";
import { getReference } from "@/services/apiClient";

export function useReference(id: string | undefined): {
  reference: Reference | null;
  loading: boolean;
  error: Error | null;
} {
  const [reference, setReference] = useState<Reference | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setReference(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setReference(null);
    setError(null);
    setLoading(true);
    getReference(id)
      .then((ref) => {
        if (!cancelled) setReference(ref);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { reference, loading, error };
}
