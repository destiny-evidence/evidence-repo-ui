import { useEffect, useState } from "preact/hooks";

import type { SearchFilters } from "@/services/apiClient";
import type { ApaReferenceInput } from "@/services/citation/apa";
import {
  runReferenceExportToCompletion,
  runSearchExportToCompletion,
} from "@/services/export/searchExportJob";
import { fetchRisAsApaInputs } from "@/services/export/risExport";

export type ReferenceListStatus = "idle" | "loading" | "ready" | "error";

export interface UseReferenceListExportResult {
  status: ReferenceListStatus;
  inputs: ApaReferenceInput[];
  error: string | null;
}

// The references to list: a whole search, or an explicit id list (a selection).
export type ReferenceSource =
  | { kind: "search"; query: string | undefined; filters: Omit<SearchFilters, "page"> }
  | { kind: "ids"; referenceIds: string[] };

/**
 * Loads a set of references as APA inputs by running a RIS export and parsing
 * the result — the same pipeline as the results-page Reference-list PDF. Used
 * by the AI summary to build its References section from the same set it
 * summarised. Re-runs when `source` changes; aborts on change/unmount.
 */
export function useReferenceListExport(
  source: ReferenceSource | null,
  enabled: boolean,
): UseReferenceListExportResult {
  const [state, setState] = useState<UseReferenceListExportResult>({
    status: "idle",
    inputs: [],
    error: null,
  });

  // Stable key so the effect re-runs only on a genuinely different source,
  // not on every render's fresh object.
  const key = enabled && source ? JSON.stringify(source) : null;

  useEffect(() => {
    if (!enabled || !source) {
      setState({ status: "idle", inputs: [], error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", inputs: [], error: null });
    (async () => {
      try {
        const resultUrl =
          source.kind === "ids"
            ? await runReferenceExportToCompletion(source.referenceIds, "ris", {
                signal: controller.signal,
              })
            : await runSearchExportToCompletion(
                // requestSearchExport omits the browse shim its callers apply.
                source.query?.trim() || "*",
                source.filters,
                "ris",
                { signal: controller.signal },
              );
        const inputs = await fetchRisAsApaInputs(resultUrl);
        if (!controller.signal.aborted) {
          setState({ status: "ready", inputs, error: null });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          inputs: [],
          error:
            err instanceof Error ? err.message : "Couldn't load references.",
        });
      }
    })();
    return () => controller.abort();
  }, [key]);

  return state;
}
