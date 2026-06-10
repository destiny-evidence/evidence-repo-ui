import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { requestSummary } from "@/services/summariserClient";
import { searchReferenceIds, type SearchFilters } from "@/services/apiClient";
import type { SummariseResponse, TermInfo } from "@/services/summariser";

export type AiSummaryStatus = "idle" | "generating" | "done" | "error";

export interface AiSummaryInput {
  /** Intersecting terms the summary is framed against. */
  terms: TermInfo[];
  /** Search query + filters identifying the references to summarise. */
  query: string | undefined;
  filters: Omit<SearchFilters, "page">;
}

export interface UseAiSummaryResult {
  status: AiSummaryStatus;
  /** True while the drawer is dismissed to the background chip. */
  minimized: boolean;
  result: SummariseResponse | null;
  errorMessage: string | null;
  /** The drawer is visible when there's an active summary and it isn't minimized. */
  drawerOpen: boolean;
  generate: (input: AiSummaryInput) => void;
  /** Bring a minimized summary back into the drawer. */
  open: () => void;
  /** Dismiss the drawer to the background chip; generation keeps running. */
  runInBackground: () => void;
  /** Abort (if running) and clear everything. */
  dismiss: () => void;
}

/**
 * Owns AI-summary generation state for a page. Lives above the drawer so a
 * summary survives "Run in background" (the drawer closing) and can be reopened
 * from the background chip without losing the result.
 */
export function useAiSummary(): UseAiSummaryResult {
  const [status, setStatus] = useState<AiSummaryStatus>("idle");
  const [minimized, setMinimized] = useState(false);
  const [result, setResult] = useState<SummariseResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Guards against a stale request resolving after dismiss/regenerate.
  const runRef = useRef(0);

  const dismiss = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    runRef.current += 1;
    setStatus("idle");
    setMinimized(false);
    setResult(null);
    setErrorMessage(null);
  }, []);

  const generate = useCallback((input: AiSummaryInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runRef.current;
    const stale = () => runRef.current !== runId;

    setStatus("generating");
    setMinimized(false);
    setResult(null);
    setErrorMessage(null);

    // Resolve every matching reference id, then summarise them. Both steps
    // honour the abort signal, so dismiss/regenerate cancels in-flight work.
    (async () => {
      try {
        const { reference_ids } = await searchReferenceIds(
          input.query,
          input.filters,
          controller.signal,
        );
        if (stale()) return;
        const res = await requestSummary(
          { terms: input.terms, referenceIds: reference_ids },
          controller.signal,
        );
        if (stale()) return;
        setResult(res);
        setStatus("done");
      } catch (err: unknown) {
        if (stale()) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMessage(
          err instanceof Error ? err.message : "Couldn't generate the summary.",
        );
        setStatus("error");
        setMinimized(false);
      }
    })();
  }, []);

  const open = useCallback(() => setMinimized(false), []);
  const runInBackground = useCallback(() => setMinimized(true), []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    status,
    minimized,
    result,
    errorMessage,
    drawerOpen: status !== "idle" && !minimized,
    generate,
    open,
    runInBackground,
    dismiss,
  };
}
