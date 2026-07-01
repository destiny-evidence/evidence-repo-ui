import { useEffect, useState } from "preact/hooks";

import type { SearchFilters } from "@/services/apiClient";
import type { ApaReferenceInput } from "@/services/citation/apa";
import { runSearchExportToCompletion } from "@/services/export/searchExportJob";
import { fetchRisAsApaInputs } from "@/services/export/risExport";

export type ReferenceListStatus = "idle" | "loading" | "ready" | "error";

export interface UseReferenceListExportResult {
  status: ReferenceListStatus;
  inputs: ApaReferenceInput[];
  error: string | null;
}

export interface ReferenceListSearch {
  query: string | undefined;
  filters: Omit<SearchFilters, "page">;
}

/**
 * Loads a search's references as APA inputs by running a RIS export for it and
 * parsing the result — the same pipeline (and the same backend bibliography) as
 * the results-page Reference-list PDF. Used by the AI summary to build its
 * References section from the search that produced it. Re-runs when `search`
 * changes; aborts in-flight work on change/unmount.
 */
export function useReferenceListExport(
  search: ReferenceListSearch | null,
  enabled: boolean,
): UseReferenceListExportResult {
  const [state, setState] = useState<UseReferenceListExportResult>({
    status: "idle",
    inputs: [],
    error: null,
  });

  // Stable key so the effect re-runs only on a genuinely different search,
  // not on every render's fresh filters object.
  const key = enabled && search ? JSON.stringify(search) : null;

  useEffect(() => {
    if (!enabled || !search) {
      setState({ status: "idle", inputs: [], error: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", inputs: [], error: null });
    (async () => {
      try {
        const resultUrl = await runSearchExportToCompletion(
          // requestSearchExport omits the browse shim its callers apply.
          search.query?.trim() || "*",
          search.filters,
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
