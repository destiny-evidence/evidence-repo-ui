import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { requestSummary } from "@/services/summariserClient";
import { searchReferenceIds, type SearchFilters } from "@/services/apiClient";
import type { SummariseResponse } from "@/services/summariser";
import type { SearchResultTotal } from "@/types/models";

export type AiSummaryStatus = "idle" | "generating" | "done" | "error";

/** What the drawer displays about a summary — snapshotted at generate time. */
export interface AiSummaryContext {
  /** Intersecting term labels (query + applied concept filters). */
  terms: string[];
  /** Matching references at the intersection (may be a lower bound). */
  count: SearchResultTotal;
  /** The community's plural noun for evidence items ("references", …). */
  countNoun: string;
}

export interface AiSummaryInput {
  /** Search query + filters identifying the references to summarise. */
  query: string | undefined;
  filters: Omit<SearchFilters, "page">;
  /** Display context, captured now so a later search can't make it drift. */
  context: AiSummaryContext;
  /** URL of the originating search, so the drawer can link back to it. */
  originUrl: string;
}

export interface UseAiSummaryResult {
  status: AiSummaryStatus;
  /** True while the drawer is dismissed to the background chip. */
  minimized: boolean;
  result: SummariseResponse | null;
  errorMessage: string | null;
  /** Context for the active summary, frozen at generate time (null when idle). */
  context: AiSummaryContext | null;
  /** URL of the search the active summary came from (null when idle). */
  originUrl: string | null;
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
 * Owns AI-summary generation state. Mounted in AiSummaryProvider above the
 * router, so a summary survives "Run in background" and navigation, and can be
 * reopened from the background chip on any page without losing the result.
 */
export function useAiSummary(): UseAiSummaryResult {
  const [status, setStatus] = useState<AiSummaryStatus>("idle");
  const [minimized, setMinimized] = useState(false);
  const [result, setResult] = useState<SummariseResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [context, setContext] = useState<AiSummaryContext | null>(null);
  const [originUrl, setOriginUrl] = useState<string | null>(null);

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
    setContext(null);
    setOriginUrl(null);
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
    // Freeze the context for this run so editing the search afterwards (while it
    // generates or runs in the background) can't change what the drawer shows.
    setContext(input.context);
    setOriginUrl(input.originUrl);

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
          {
            terms: input.context.terms.map((name) => ({ name })),
            referenceIds: reference_ids,
          },
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
    context,
    originUrl,
    drawerOpen: status !== "idle" && !minimized,
    generate,
    open,
    runInBackground,
    dismiss,
  };
}
