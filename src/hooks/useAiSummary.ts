import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { requestSummary } from "@/services/summariserClient";
import { searchReferenceIds, type SearchFilters } from "@/services/apiClient";
import { resolveSelectedReferenceIds } from "@/services/referenceSelection";
import type { SelectionRequest } from "@/hooks/useReferenceSelection";
import type { ReferenceSource } from "@/hooks/useReferenceListExport";
import type { SummariseResponse } from "@/services/summariser";
import type { SearchResultTotal } from "@/types/models";

export type AiSummaryStatus = "idle" | "generating" | "done" | "error";

/**
 * Where a dismiss came from. `community-switch` is the provider dropping a
 * summary that no longer belongs to the page — not a user cancelling, so it
 * isn't tracked as one.
 */
export type DismissSource = "drawer" | "chip" | "community-switch";

/** Whether the job was backgrounded via the button or by closing the drawer. */
export type BackgroundSource = "button" | "close";

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
  /** When set, summarise this selection instead of the whole search. */
  selection?: SelectionRequest;
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
  /**
   * The summarised reference set, retained so the drawer can request it as a
   * RIS export for its bibliography. Null when idle.
   */
  referenceSource: ReferenceSource | null;
  /** The drawer is visible when there's an active summary and it isn't minimized. */
  drawerOpen: boolean;
  generate: (input: AiSummaryInput) => void;
  /** Bring a minimized summary back into the drawer. */
  open: () => void;
  /** Dismiss the drawer to the background chip; generation keeps running. */
  runInBackground: (source: BackgroundSource) => void;
  /** Abort (if running) and clear everything. */
  dismiss: (source?: DismissSource) => void;
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
  const [referenceSource, setReferenceSource] = useState<ReferenceSource | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Guards against a stale request resolving after dismiss/regenerate.
  const runRef = useRef(0);
  // Status as of now, for the stable callbacks below — they'd otherwise close
  // over the status of the render that created them.
  const statusRef = useRef<AiSummaryStatus>("idle");
  const startedAt = useRef<number | null>(null);

  const setPhase = useCallback((next: AiSummaryStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // Wall-clock wait the user actually sat through
  const elapsedMs = useCallback(
    () => (startedAt.current === null ? 0 : Date.now() - startedAt.current),
    [],
  );

  const dismiss = useCallback((source: DismissSource = "drawer") => {
    if (statusRef.current === "generating" && source !== "community-switch") {
      track({
        category: "AISummary",
        action: "Cancelled",
        name: source,
        value: elapsedMs(),
      });
    }
    abortRef.current?.abort();
    abortRef.current = null;
    runRef.current += 1;
    setPhase("idle");
    setMinimized(false);
    setResult(null);
    setErrorMessage(null);
    setContext(null);
    setOriginUrl(null);
    setReferenceSource(null);
  }, [setPhase, elapsedMs]);

  const generate = useCallback((input: AiSummaryInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runRef.current;
    const stale = () => runRef.current !== runId;

    startedAt.current = Date.now();
    track({
      category: "AISummary",
      action: "Generate Requested",
      value: input.context.count.count,
    });

    setPhase("generating");
    setMinimized(false);
    setResult(null);
    setErrorMessage(null);
    // Freeze the context for this run so editing the search afterwards (while it
    // generates or runs in the background) can't change what the drawer shows.
    setContext(input.context);
    setOriginUrl(input.originUrl);
    setReferenceSource(null);

    // Resolve the reference ids (selection or whole search), then summarise
    // them. Both steps honour the abort signal, so dismiss/regenerate cancels
    // in-flight work. The bibliography reads referenceSource, set here so it
    // lists exactly the summarised set.
    (async () => {
      try {
        let referenceIds: string[];
        if (input.selection) {
          referenceIds = await resolveSelectedReferenceIds(
            input.selection,
            input.query,
            input.filters,
            controller.signal,
          );
          if (stale()) return;
          setReferenceSource({ kind: "ids", referenceIds });
        } else {
          const res = await searchReferenceIds(
            input.query,
            input.filters,
            controller.signal,
          );
          if (stale()) return;
          referenceIds = res.reference_ids;
          setReferenceSource({
            kind: "search",
            query: input.query,
            filters: input.filters,
          });
        }
        const res = await requestSummary(
          {
            terms: input.context.terms.map((name) => ({ name })),
            referenceIds,
          },
          controller.signal,
        );
        if (stale()) return;
        setResult(res);
        setPhase("done");
        track({
          category: "AISummary",
          action: "Completed",
          value: elapsedMs(),
        });
      } catch (err: unknown) {
        if (stale()) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMessage(
          err instanceof Error ? err.message : "Couldn't generate the summary.",
        );
        setPhase("error");
        setMinimized(false);
        // No name: error text can carry ids and urls, and isn't ours to send.
        track({ category: "AISummary", action: "Error", value: elapsedMs() });
      }
    })();
  }, [setPhase, elapsedMs]);

  // Only the background chip calls this, and it renders only while minimized, so
  // every call is a genuine return to a backgrounded summary.
  const open = useCallback(() => {
    track({
      category: "AISummary",
      action: "Reopened",
      name: statusRef.current,
    });
    setMinimized(false);
  }, []);
  const runInBackground = useCallback((source: BackgroundSource) => {
    track({ category: "AISummary", action: "Run In Background", name: source });
    setMinimized(true);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    status,
    minimized,
    result,
    errorMessage,
    context,
    originUrl,
    referenceSource,
    drawerOpen: status !== "idle" && !minimized,
    generate,
    open,
    runInBackground,
    dismiss,
  };
}
