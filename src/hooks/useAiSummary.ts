import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { requestSummary } from "@/services/summariserClient";
import type { SummariseResponse, SummaryRequest } from "@/services/summariser";

export type AiSummaryStatus = "idle" | "generating" | "done" | "error";

export interface UseAiSummaryResult {
  status: AiSummaryStatus;
  /** True while the drawer is dismissed to the background chip. */
  minimized: boolean;
  result: SummariseResponse | null;
  errorMessage: string | null;
  /** The drawer is visible when there's an active summary and it isn't minimized. */
  drawerOpen: boolean;
  generate: (request: SummaryRequest) => void;
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

  const generate = useCallback((request: SummaryRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runRef.current;

    setStatus("generating");
    setMinimized(false);
    setResult(null);
    setErrorMessage(null);

    requestSummary(request, controller.signal).then(
      (res) => {
        if (runRef.current !== runId) return;
        setResult(res);
        setStatus("done");
      },
      (err: unknown) => {
        if (runRef.current !== runId) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorMessage(
          err instanceof Error ? err.message : "Couldn't generate the summary.",
        );
        setStatus("error");
        setMinimized(false);
      },
    );
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
